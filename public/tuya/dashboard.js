/* global document, window, navigator, localStorage, sessionStorage */
/* eslint-disable no-use-before-define -- UI handlers refer to the rendering functions below. */

'use strict';

(() => {
  const pages = ['dashboard', 'interactive', 'live', 'expert', 'changelog', 'heating-curve'];
  const page = window.location.pathname.slice(1) || 'dashboard';
  let language = localStorage.getItem('tuya-dashboard-language') || (navigator.language.startsWith('nl') ? 'nl' : 'en');
  let texts = {};
  let deviceId = '';
  let capabilities = [];
  let snapshot = null;
  let payload = [];
  let filter = '';
  let writableOnly = false;
  let expertView = 'number';
  const expertGroupsOpen = new Map();
  let changedOnly = false;
  let sortKey = 'id';
  let sortAscending = true;
  const expandedGroups = { writable: true, readonly: true };
  let timer = null;
  let generation = 0;
  let commandIds = [];
  const $ = (id) => document.getElementById(id);
  const t = (key) => texts[language]?.[key] || texts.en?.[key] || key;
  const label = (value) => (typeof value === 'string' ? value : value?.[language] || value?.en || '');
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const time = (at) => (at ? new Date(at).toLocaleString(language, { timeZoneName: 'short' }) : t('unknown'));
  const format = (value) => {
    if (value === null || value === undefined) return t('unknown');
    if (typeof value === 'boolean') return t(value ? 'on' : 'off');
    if (typeof value === 'number') return value.toLocaleString(language, { maximumFractionDigits: 3 });
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  };
  const receivedTime = (at) => `${time(at)}${at && Date.now() - at > 60000 ? ` · ${t('stale')}` : ''}`;
  const capName = (cap) => label(cap.title) || (cap.id === 'onoff' ? t('onoff') : cap.id);
  const capValue = (cap) => label(cap.values?.find((item) => item.id === cap.value)?.title) || format(cap.value);
  const unit = (cap) => (['boolean', 'enum'].includes(cap.type) ? '' : label(cap.units) || cap.unit || '');
  async function request(route, body) {
    const controller = new window.AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(route, {
        signal: controller.signal,
        ...(body ? {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(t(result.error || 'server_error'));
      return result;
    } finally {
      window.clearTimeout(deadline);
    }
  }

  const api = (resource) => `/api/devices/${encodeURIComponent(deviceId)}/${resource}`;
  function table(headings, rows) {
    const wrap = el('div', undefined, 'table-wrap');
    const node = el('table'); const head = el('thead'); const header = el('tr');
    headings.forEach((heading) => header.append(el('th', heading)));
    head.append(header); node.append(head);
    const body = el('tbody');
    rows.forEach((row) => {
      const tr = el('tr');
      row.forEach((value, index) => {
        const td = el('td');
        if (page === 'dashboard') td.className = ['name', 'value', 'unit', 'received'][index] || '';
        if (page === 'expert') td.className = ['addr', 'name-cell', 'val-raw', 'val-scaled', 'unit'][index] || '';
        if (value instanceof window.Node) td.append(value); else td.textContent = value;
        tr.append(td);
      });
      body.append(tr);
    });
    node.append(body); wrap.append(node); return wrap;
  }
  function card(title, value, units = '', note = '') {
    const live = page === 'live';
    const node = el('div', undefined, live ? 'cap-card' : 'card');
    const body = live ? el('div', undefined, 'cap-body') : node;
    if (live) node.append(body);
    body.append(el('div', title, live ? 'cap-title' : 'card-label'));
    const rendered = `${value}${units ? ` ${units}` : ''}`;
    body.append(el('div', rendered, `${live ? 'cap-value' : 'card-value'}${rendered.length > 40 ? ' long' : ''}`));
    if (note) body.append(el('small', note, live ? 'cap-unit' : 'muted'));
    return node;
  }
  function capGroup(cap) {
    if (/cop|scop/.test(cap.id)) return 'efficiency';
    if (/hotwater|capacity_set|around_temp_f/.test(cap.id)) return 'dhw';
    if (/indoor|building|adaptive|insight|simulated|forecast|wind|solar|heating_curve/.test(cap.id)) return 'adaptive';
    if (/temperature/.test(cap.id)) return 'temperatures';
    if (/power|energy|current|voltage|price/.test(cap.id)) return 'energy';
    if (/onoff|mode|frequency|countdown|state|water|pulse/.test(cap.id)) return 'heating';
    return 'diagnostics';
  }
  function renderOverview() {
    const content = $('content'); content.replaceChildren();
    if (page === 'live') {
      const grid = el('div', undefined, 'rubric-tiles');
      const units = {
        outletC: '°C', inletC: '°C', ambientC: '°C', setpointC: '°C', deltaTC: '°C', flowLpm: 'L/min', electricalPowerKw: 'kW', thermalPowerKw: 'kW', compressorHz: 'Hz',
      };
      const values = { ...snapshot.temperatures, ...snapshot.process };
      ['outletC', 'inletC', 'ambientC', 'setpointC', 'deltaTC', 'flowLpm', 'electricalPowerKw', 'thermalPowerKw', 'liveCopEstimate', 'capabilityCop', 'compressorHz'].forEach((key) => {
        let source = '';
        if (key === 'flowLpm') source = t(snapshot.process.flowSource);
        if (key === 'electricalPowerKw') source = t(snapshot.process.powerSource);
        grid.append(card(t(key), format(values[key]), units[key], source));
      });
      const summary = el('section', undefined, 'rubric-card summary');
      summary.append(grid); content.append(summary);
    }
    const groups = el('div', undefined, 'rubric-section');
    if (page === 'live') content.append(groups);
    ['heating', 'temperatures', 'dhw', 'energy', 'efficiency', 'adaptive', 'diagnostics'].forEach((group) => {
      const caps = capabilities.filter((cap) => capGroup(cap) === group);
      if (!caps.length) return;
      if (page === 'live') {
        const section = el('section', undefined, 'rubric-card');
        section.append(el('h2', t(group), 'rubric-header'));
        const grid = el('div', undefined, 'rubric-tiles');
        caps.forEach((cap) => grid.append(card(capName(cap), capValue(cap), unit(cap), `${t('received')}: ${receivedTime(cap.receivedAt)}`)));
        section.append(grid); groups.append(section);
      } else {
        content.append(el('h2', t(group), 'section-header'));
        content.append(table([t('name'), t('value'), t('unit'), t('received')], caps.map((cap) => [capName(cap), capValue(cap), unit(cap), receivedTime(cap.receivedAt)])));
      }
    });
  }
  function controlForm(cap) {
    const form = el('form', undefined, 'write-card');
    const id = `control-${cap.id}`;
    const title = el('label', capName(cap)); title.htmlFor = id;
    let input;
    if (cap.type === 'enum' || cap.type === 'boolean') {
      input = el('select');
      const choices = cap.type === 'boolean' ? [{ id: 'true', title: t('on') }, { id: 'false', title: t('off') }] : cap.values;
      input.append(new window.Option(t('unknown'), ''));
      choices.forEach((choice) => input.append(new window.Option(label(choice.title), choice.id)));
      input.value = cap.value === null ? '' : String(cap.value);
    } else {
      input = el('input'); input.type = 'number'; input.min = cap.min; input.max = cap.max; input.step = cap.step || 1;
      input.value = cap.value ?? '';
    }
    input.id = id; input.required = true;
    const actual = el('small', `${t('actual')}: ${capValue(cap)} ${unit(cap)}`);
    actual.dataset.capability = cap.id;
    const button = el('button', t('apply'), 'btn btn-primary'); button.type = 'submit';
    const row = el('div', undefined, 'write-row');
    row.append(input, button);
    form.append(title, actual, row);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const selectedId = deviceId;
      let { value } = input;
      if (cap.type === 'boolean') value = input.value === 'true';
      if (cap.type === 'number') value = Number(input.value);
      button.disabled = true;
      try {
        const command = await request(api('commands'), { capability: cap.id, value });
        if (selectedId !== deviceId) return;
        commandIds = [...commandIds, command.id].slice(-10);
        sessionStorage.setItem(`tuya-commands-${deviceId}`, JSON.stringify(commandIds));
        await showCommands();
      } catch (error) {
        showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
    return form;
  }
  function renderControls() {
    // Keep user edits and focus during periodic refreshes.
    if (!$('content').children.length) {
      const grid = el('div', undefined, 'write-grid');
      capabilities.filter((cap) => cap.writable).forEach((cap) => grid.append(controlForm(cap)));
      $('content').append(el('p', t('confirmation_note'), 'muted'), grid);
    }
    document.querySelectorAll('[data-capability]').forEach((node) => {
      const cap = capabilities.find((item) => item.id === node.dataset.capability);
      if (cap) node.textContent = `${t('actual')}: ${capValue(cap)} ${unit(cap)}`;
    });
  }
  const normalizeSearch = (value) => String(value).normalize('NFKC').toLowerCase().trim();
  function matchesDatapoint(dp) {
    const names = typeof dp.name === 'object' && dp.name ? Object.values(dp.name) : [dp.name || t('unknown_dps')];
    const haystack = normalizeSearch([
      dp.id, `DP${dp.id}`, `DPS${dp.id}`, `DPS ${dp.id}`, ...names,
      label(dp.units), ...dp.capabilities, format(dp.raw), format(dp.value),
      dp.raw ?? '', dp.value ?? '',
    ].join(' '));
    return normalizeSearch(filter).split(/\s+/).every((term) => haystack.includes(term));
  }
  function renderExpert() {
    const rows = payload.filter((dp) => (!writableOnly || dp.writable.length) && matchesDatapoint(dp));
    const rendered = rows.map((dp) => {
      const actions = el('div');
      dp.writable.forEach((id) => {
        const cap = capabilities.find((item) => item.id === id);
        if (!cap) return;
        const button = el('button', t('control'), 'btn-write');
        button.addEventListener('click', () => {
          $('dialog-content').replaceChildren(controlForm(cap), el('p', t('confirmation_note'), 'muted'));
          $('control-dialog').showModal();
        });
        actions.append(button);
      });
      const stamp = el('span', time(dp.receivedAt));
      if (dp.receivedAt && Date.now() - dp.receivedAt > 60000) stamp.append(el('small', t('stale')));
      return [`DP${dp.id}`, label(dp.name) || t('unknown_dps'), format(dp.raw), format(dp.value), label(dp.units), dp.capabilities.join(', '), stamp, time(dp.changedAt), actions];
    });
    const headings = ['DPS', t('name'), t('raw'), t('value'), t('unit'), t('capabilities'), t('received'), t('changed'), t('control')];
    $('content').replaceChildren(el('p', `${rows.length} / ${payload.length} ${t('parameters')}`, 'filter-count'));
    if (!rows.length) {
      $('content').append(el('p', t('no_matches'), 'muted')); return;
    }
    if (expertView === 'number') {
      $('content').append(table(headings, rendered)); return;
    }
    const groups = new Map();
    rows.forEach((dp, index) => {
      const group = expertView === 'unit' ? normalizeSearch(label(dp.units))
        : capGroup({ id: dp.capabilities[0] || '' });
      if (!groups.has(group)) groups.set(group, { title: expertView === 'unit' ? label(dp.units).normalize('NFKC') || t('no_unit') : t(group), rows: [] });
      groups.get(group).rows.push(rendered[index]);
    });
    [...groups].sort(([, a], [, b]) => a.title.localeCompare(b.title, language)).forEach(([group, data]) => {
      const key = `${expertView}:${group}`;
      const section = el('details', undefined, 'block'); section.open = expertGroupsOpen.get(key) !== false;
      section.classList.toggle('open', section.open);
      section.addEventListener('toggle', () => {
        expertGroupsOpen.set(key, section.open); section.classList.toggle('open', section.open);
      });
      const heading = el('summary', undefined, 'block-header');
      heading.append(el('span', '▶', 'chevron'), el('span', `${data.title} (${data.rows.length})`, 'block-title'));
      section.append(heading, table(headings, data.rows)); $('content').append(section);
    });
  }
  const changeColumns = [
    ['id', 'DPS'], ['name', 'name'], ['changeCount', 'change_count'],
    ['previousRaw', 'previous'], ['previousChangedAt', 'previous_since'],
    ['raw', 'raw'], ['value', 'value'], ['units', 'unit'],
    ['firstSeen', 'first_seen'], ['lastChanged', 'changed'],
    ['avgInterval', 'avg_interval'], ['minInterval', 'min_interval'], ['maxInterval', 'max_interval'],
  ];
  const duration = (ms) => (ms === null ? '—' : `${format(ms / 1000)} s`);
  function filteredChanges() {
    return payload.filter((dp) => (!changedOnly || dp.changeCount > 0)
      && matchesDatapoint(dp))
      .sort((a, b) => {
        const value = (dp) => (['name', 'units'].includes(sortKey) ? label(dp[sortKey]) : dp[sortKey]);
        const left = value(a); const right = value(b);
        if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
        if (right === null || right === undefined) return -1;
        const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), language, { numeric: true });
        return (sortAscending ? order : -order) || a.id - b.id;
      });
  }
  function changeCells(dp) {
    return changeColumns.map(([key]) => {
      if (key === 'id') return `DP${dp.id}`;
      if (key === 'name') return label(dp.name) || t('unknown_dps');
      if (key === 'units') return label(dp.units);
      if (['previousChangedAt', 'firstSeen', 'lastChanged'].includes(key)) return dp[key] === null ? '—' : time(dp[key]);
      if (key.endsWith('Interval')) return duration(dp[key]);
      return format(dp[key]);
    });
  }
  function renderChanges() {
    const rows = filteredChanges();
    $('content').replaceChildren(el('p', t('log_note'), 'muted'), el('p', `${rows.length} / ${payload.length} ${t('parameters')}`, 'muted'));
    ['writable', 'readonly'].forEach((group) => {
      const members = rows.filter((dp) => (dp.writable.length > 0) === (group === 'writable'));
      const section = el('details'); section.open = expandedGroups[group];
      section.addEventListener('toggle', () => {
        expandedGroups[group] = section.open;
      });
      section.append(el('summary', `${t(group)} (${members.length})`));
      const grid = table(changeColumns.map(([, title]) => t(title)), members.map(changeCells));
      grid.querySelectorAll('th').forEach((th, index) => {
        const key = changeColumns[index][0];
        const active = key === sortKey;
        const direction = sortAscending ? 'ascending' : 'descending';
        const arrow = sortAscending ? ' ▲' : ' ▼';
        th.setAttribute('aria-sort', active ? direction : 'none');
        const button = el('button', `${th.textContent}${active ? arrow : ''}`, 'sort-column');
        button.addEventListener('click', () => {
          sortAscending = active ? !sortAscending : true; sortKey = key; renderChanges();
        });
        th.replaceChildren(button);
      });
      grid.querySelectorAll('tbody tr').forEach((tr) => {
        tr.children[0].className = 'addr'; tr.children[1].className = 'name';
        tr.children[1].title = tr.children[1].textContent;
      });
      section.append(members.length ? grid : el('p', t('no_matches'), 'empty'));
      $('content').append(section);
    });
  }
  function download(kind) {
    const rows = filteredChanges();
    const escape = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
    const iso = (at) => (at === null ? null : new Date(at).toISOString());
    const content = kind === 'json' ? JSON.stringify(rows.map((dp) => ({
      ...dp,
      receivedAt: iso(dp.receivedAt),
      changedAt: iso(dp.changedAt),
      firstSeen: iso(dp.firstSeen),
      previousChangedAt: iso(dp.previousChangedAt),
      lastChanged: iso(dp.lastChanged),
    })), null, 2) : [
      `# ${t('changelog')} — ${$('device-name').textContent}`, '', t('log_note'), '',
      `| ${changeColumns.map(([, title]) => t(title)).join(' | ')} |`,
      `| ${changeColumns.map(() => '---').join(' | ')} |`,
      ...rows.map((dp) => `| ${changeCells(dp).map(escape).join(' | ')} |`),
    ].join('\n');
    const blob = new Blob([content], { type: kind === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob); const link = el('a'); link.href = url; link.download = `tuya-parameters.${kind === 'json' ? 'json' : 'md'}`; link.click(); URL.revokeObjectURL(url);
  }
  function renderCurve() {
    const grid = el('div', undefined, 'grid');
    const fields = [
      ['heating_preset', 'heating'], ['dhw_preset', 'hotWater'],
      ['ambientC', 'ambient'], ['setpointC', 'setpoint'], ['recommendation', 'recommendation'],
    ];
    fields.forEach(([title, key]) => {
      const units = ['ambient', 'setpoint', 'recommendation'].includes(key) ? '°C' : '';
      grid.append(card(t(title), format(payload[key]), units));
    });
    $('content').replaceChildren(grid, el('p', t('preset_note'), 'muted'), el('h2', t('app_curve')), el('p', t('app_curve_note'), 'muted'));
    if (!payload.appCurve) {
      $('content').append(el('p', t('unknown'))); return;
    }
    const svg = (tag, attributes, text) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const graph = svg('svg', {
      viewBox: '0 0 720 340', class: 'curve', role: 'img', 'aria-label': t('app_curve'),
    });
    const x = (v) => 65 + (v + 20) * 15;
    const y = (v) => 285 - v * 3.2;
    [-20, -10, 0, 10, 20].forEach((v) => {
      graph.append(svg('line', {
        x1: x(v), x2: x(v), y1: 30, y2: 285, stroke: 'var(--line)',
      }));
      graph.append(svg('text', {
        x: x(v), y: 305, fill: 'var(--muted)', 'text-anchor': 'middle', 'font-size': 12,
      }, v));
    });
    [0, 20, 40, 60, 80].forEach((v) => {
      graph.append(svg('line', {
        x1: 65, x2: 665, y1: y(v), y2: y(v), stroke: 'var(--line)',
      }));
      graph.append(svg('text', {
        x: 50, y: y(v) + 4, fill: 'var(--muted)', 'text-anchor': 'end', 'font-size': 12,
      }, v));
    });
    const points = Array.from({ length: 81 }, (_, i) => {
      const outdoor = -20 + i / 2;
      return `${x(outdoor)},${y(Math.min(80, Math.max(0, payload.appCurve.slope * outdoor + payload.appCurve.intercept)))}`;
    });
    graph.append(svg('polyline', {
      points: points.join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3,
    }));
    graph.append(svg('text', {
      x: 365, y: 330, fill: 'var(--muted)', 'text-anchor': 'middle', 'font-size': 12,
    }, t('outdoor_axis')));
    graph.append(svg('text', {
      x: 65, y: 20, fill: 'var(--muted)', 'font-size': 12,
    }, t('water_axis')));
    $('content').append(graph, el('p', `y = ${format(payload.appCurve.slope)} × x + ${format(payload.appCurve.intercept)}`, 'muted'));
  }
  function renderPage() {
    if (page === 'dashboard' || page === 'live') renderOverview();
    if (page === 'interactive') renderControls();
    if (page === 'expert') renderExpert();
    if (page === 'changelog') renderChanges();
    if (page === 'heating-curve') renderCurve();
  }
  function buildToolbar() {
    $('toolbar').replaceChildren();
    if (!['expert', 'changelog'].includes(page)) return;
    const toolbar = el('div', undefined, page === 'expert' ? 'filter-bar' : 'toolbar');
    const input = el('input', undefined, page === 'expert' ? 'filter-search' : ''); input.type = 'search'; input.placeholder = t('search'); input.setAttribute('aria-label', t('search'));
    input.addEventListener('input', () => {
      filter = input.value; renderPage();
    }); toolbar.append(input);
    if (page === 'expert') {
      const views = el('div', undefined, 'view-toggle'); views.setAttribute('aria-label', t('view'));
      ['number', 'functional', 'unit'].forEach((mode) => {
        const button = el('button', t(`view_${mode}`), mode === expertView ? 'active' : '');
        button.type = 'button'; button.setAttribute('aria-pressed', String(mode === expertView));
        button.addEventListener('click', () => {
          expertView = mode;
          views.querySelectorAll('button').forEach((item) => {
            item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button));
          });
          renderExpert();
        });
        views.append(button);
      });
      $('toolbar').append(views);
      const labelNode = el('label', undefined, 'filter-writable'); const check = el('input'); check.type = 'checkbox';
      check.addEventListener('change', () => {
        writableOnly = check.checked; renderExpert();
      });
      labelNode.append(check, document.createTextNode(` ${t('writable_only')}`)); toolbar.append(labelNode);
    } else {
      const labelNode = el('label', undefined, 'filter-label'); const check = el('input'); check.type = 'checkbox';
      check.addEventListener('change', () => {
        changedOnly = check.checked; renderChanges();
      });
      labelNode.append(check, document.createTextNode(` ${t('changed_only')}`)); toolbar.append(labelNode);
      ['json', 'markdown'].forEach((kind) => {
        const button = el('button', t(`export_${kind}`), 'btn'); button.addEventListener('click', () => download(kind)); toolbar.append(button);
      });
    }
    $('toolbar').append(toolbar);
  }
  function showError(message) {
    $('error').textContent = message; $('error').hidden = false;
  }
  async function showCommands(token = generation) {
    const results = await Promise.all(commandIds.map(async (id) => {
      try {
        return await request(api(`commands/${id}`));
      } catch {
        return null;
      }
    }));
    if (token !== generation) return;
    $('commands').replaceChildren(...results.filter(Boolean).map((cmd) => {
      const cap = capabilities.find((item) => item.id === cmd.capability);
      return el('p', `${cap ? capName(cap) : cmd.capability}: ${format(cmd.value)} · ${t(cmd.status)}`);
    }));
  }
  async function refresh(token = generation) {
    if (!deviceId || document.hidden) return;
    const resource = ({ expert: 'dps', changelog: 'changes', 'heating-curve': 'heating-curve' })[page];
    try {
      const results = await Promise.all([request(api('snapshot')), request(api('capabilities')), resource ? request(api(resource)) : Promise.resolve([])]);
      if (token !== generation) return;
      [snapshot, capabilities, payload] = results;
      $('error').hidden = true;
      $('connection').textContent = t(snapshot.status.connectionState);
      $('connection').className = `status-connection ${snapshot.status.connectionState}`;
      $('alarm').hidden = snapshot.status.faultActive === null || Number(snapshot.status.faultActive) === 0;
      $('alarm').textContent = `${t('fault')}: ${format(snapshot.status.faultActive)}`;
      $('freshness').textContent = `${t('received')}: ${time(snapshot.data.timestamp)}${snapshot.data.freshness === 'stale' ? ` · ${t('stale')}` : ''}`;
      $('footnote').textContent = `${t('age_note')}${snapshot.adaptiveEnabled ? ` ${t('adaptive_note')}` : ''}`;
      renderPage(); await showCommands(token);
    } catch (error) {
      if (token === generation) showError(`${t('fetch_error')} ${error.message}`);
    }
    if (token === generation && !document.hidden) timer = window.setTimeout(() => refresh(token), 5000);
  }
  function useDevice(device) {
    generation += 1; window.clearTimeout(timer);
    deviceId = device.id;
    $('device-name').textContent = `${t('app_title')} — ${device.name}`;
    $('content').replaceChildren(); $('commands').replaceChildren(); $('control-dialog').close();
    try {
      commandIds = JSON.parse(sessionStorage.getItem(`tuya-commands-${deviceId}`) || '[]');
    } catch {
      commandIds = [];
    }
    refresh().catch((error) => showError(error.message));
  }
  async function init() {
    texts = await request('/api/texts');
    document.documentElement.lang = language;
    document.title = `${t(page)} — ${t('app_title')}`;
    $('title').textContent = t(page);
    $('language-label').textContent = t('language'); $('language').value = language;
    $('close-dialog').textContent = t('close'); $('close-dialog').addEventListener('click', () => $('control-dialog').close());
    pages.forEach((key) => {
      const a = el('a', t(key), key === page ? 'active' : ''); a.href = key === 'dashboard' ? '/' : `/${key}`;
      if (key === page) a.setAttribute('aria-current', 'page'); $('nav').append(a);
    });
    buildToolbar();
    const devices = await request('/api/devices');
    $('language').addEventListener('change', () => {
      language = $('language').value; localStorage.setItem('tuya-dashboard-language', language); window.location.reload();
    });
    document.addEventListener('visibilitychange', () => {
      generation += 1; window.clearTimeout(timer);
      if (!document.hidden) refresh().catch((error) => showError(error.message));
    });
    window.addEventListener('pagehide', () => {
      generation += 1; window.clearTimeout(timer);
    });
    if (devices.length) useDevice(devices[0]); else $('content').append(el('p', t('no_devices')));
  }
  init().catch((error) => showError(error.message));
})();
