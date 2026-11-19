/* eslint-disable no-console */

'use strict';

/**
 * Flow card reference (docs/setup/guide/FLOW_CARDS_REFERENCE.<lang>.md).
 *
 * Builds one reference per language from app.json: title, kind, drivers, description (hint),
 * fields and tokens of every Flow card. Cards that exist once per driver (suffix _modbus or
 * _aurora3) are shown once, with all their drivers. The examples are written by hand in
 * docs/setup/guide/flow-examples/<lang>.json, keyed by the card ID without driver suffix.
 *
 * Usage:
 *   node scripts/docs/flow-reference.js           write the four references
 *   node scripts/docs/flow-reference.js --check   fail when a reference is out of date
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LANGS = ['nl', 'en', 'de', 'fr'];
const KINDS = ['triggers', 'conditions', 'actions'];
const GUIDE_DIR = path.join(ROOT, 'docs', 'setup', 'guide');
const EXAMPLES_DIR = path.join(GUIDE_DIR, 'flow-examples');

/** Topic per card function; a function missing here fails the unit test. */
const TOPICS = {
  control: [
    'device_power_is', 'set_device_onoff', 'compressor_running', 'dhw_heating_active',
    'work_mode_is', 'set_work_mode', 'work_mode_changed', 'heating_mode_is', 'set_heating_mode', 'heating_mode_changed',
    'water_mode_is', 'set_water_mode', 'water_mode_changed', 'silent_mode_is', 'set_silent_mode',
    'target_temperature_is', 'set_target_temperature', 'set_setpoint_for_mode',
    'hotwater_temperature_is', 'set_hotwater_temperature', 'set_dhw_function', 'set_backup_heater',
    'heating_curve_is', 'set_heating_curve', 'set_curve_for_mode', 'set_diy_heating_curve',
    'capacity_setting_is', 'set_capacity', 'volume_setting_is', 'set_volume',
  ],
  temperatures: [
    'fault_detected', 'fault_active',
    'ambient_temperature_changed', 'inlet_temperature_changed', 'inlet_temperature_value_changed',
    'outlet_temperature_changed', 'outlet_temperature_value_changed', 'temperature_above', 'temperature_differential',
    'discharge_temperature_alert', 'suction_temperature_alert', 'high_pressure_temperature_alert',
    'low_pressure_temperature_alert', 'economizer_inlet_temperature_alert', 'economizer_outlet_temperature_alert',
    'coiler_temperature_alert', 'incoiler_temperature_alert', 'tank_temperature_alert',
    'eev_pulse_steps_alert', 'evi_pulse_steps_alert', 'system_pulse_steps_differential',
    'compressor_efficiency_alert', 'fan_motor_efficiency_alert', 'water_flow_alert', 'water_flow_rate_check',
    'electrical_balance_check',
  ],
  energy: [
    'power_threshold_exceeded', 'power_above_threshold', 'total_consumption_milestone', 'total_consumption_above',
    'daily_consumption_threshold', 'daily_cost_threshold',
    'cop_efficiency_changed', 'cop_efficiency_check', 'cop_outlier_detected', 'cop_trend_detected', 'cop_trend_analysis',
    'cop_calculation_method_is', 'daily_cop_efficiency_changed', 'daily_cop_above_threshold',
    'monthly_cop_efficiency_changed', 'monthly_cop_above_threshold',
    'performance_report_ready', 'generate_performance_report',
  ],
  prices: [
    'cheapest_block_started', 'expensive_block_approaching', 'price_threshold_crossed', 'price_trend_changed',
    'price_in_cheapest_hours', 'price_trend_is', 'price_vs_daily_average', 'savings_above',
    'receive_external_energy_prices',
  ],
  adaptive: [
    'adaptive_status_change', 'adaptive_simulation_update', 'temperature_adjustment_recommended',
    'set_desired_indoor_temperature', 'building_insight_detected', 'building_profile_mismatch', 'insight_is_active',
    'confidence_above', 'learning_milestone_reached', 'force_insight_analysis',
    'pre_heat_recommendation', 'calculate_preheat_time', 'forecast_heating_advice',
  ],
  external: [
    'receive_external_indoor_temperature', 'receive_external_ambient_data', 'receive_external_power_data',
    'receive_external_flow_data', 'receive_external_wind_data', 'receive_external_solar_radiation',
    'receive_external_solar_power',
  ],
  calculators: [
    'calculate_curve_value', 'calculate_linear_heating_curve', 'calculate_time_based_value', 'get_seasonal_mode',
  ],
  modbus: ['modbus_read_register', 'modbus_write_register'],
};

const TOPIC_ORDER = Object.keys(TOPICS);

/** Drivers in the order the readme introduces them. */
const DRIVER_ORDER = ['intelligent-heat-pump', 'intelligent-heatpump-modbus', 'intelligent-heatpump-aurora3'];

const TEXT = {
  nl: {
    title: 'Flow-kaarten: naslag',
    intro: [
      'Deze naslag beschrijft elke Flow-kaart van de app: wat de kaart doet, voor welke drivers hij bestaat, welke velden hij heeft en een voorbeeld.',
      'Hij wordt gemaakt uit de kaarten in de app zelf; niet met de hand bewerken.',
      'Kaarten met boven of onder en een drempel gaan af bij elke meting die genoeg verandert terwijl de '
        + 'waarde aan de voorwaarde voldoet, dus niet één keer bij het overschrijden. Stuurt zo\'n kaart een '
        + 'melding, gebruik dan een Ja/Nee-variabele om herhaling te voorkomen (zie het voorbeeld bij Water '
        + 'doorstroom alarm).',
      'Een uitgewerkte inleiding met scenario\'s staat in [FLOW_CARDS_GUIDE.nl.md](FLOW_CARDS_GUIDE.nl.md).',
    ],
    contents: 'Inhoud',
    kinds: { triggers: 'Triggers', conditions: 'Voorwaarden', actions: 'Acties' },
    kind: { triggers: 'Trigger', conditions: 'Voorwaarde', actions: 'Actie' },
    topics: {
      control: 'Bediening en modi',
      temperatures: 'Temperaturen, storingen en alarmen',
      energy: 'Energie en rendement (COP)',
      prices: 'Energieprijzen',
      adaptive: 'Adaptieve regeling en gebouwmodel',
      external: 'Externe gegevens',
      calculators: 'Rekenhulpen',
      modbus: 'Modbus-registers',
    },
    tokens: 'Tokens',
    example: 'Voorbeeld',
    deprecated: 'Vervallen: niet meer te kiezen in nieuwe flows.',
    noExample: 'Voorbeeld volgt.',
    number: 'getal',
    text: 'tekst',
    choice: 'keuze uit een lijst',
    yesNo: 'ja/nee',
    to: 'tot',
  },
  en: {
    title: 'Flow cards: reference',
    intro: [
      'This reference describes every Flow card of the app: what the card does, which drivers it exists for, its fields and an example.',
      'It is generated from the cards in the app itself; do not edit it by hand.',
      'Cards with above or below and a threshold fire on every reading that changes enough while the value '
        + 'meets the condition, so not once when the threshold is crossed. When such a card sends a '
        + 'notification, use a Yes/No variable to prevent repeats (see the example for the water flow alert).',
      'A worked introduction with scenarios is in [FLOW_CARDS_GUIDE.en.md](FLOW_CARDS_GUIDE.en.md).',
    ],
    contents: 'Contents',
    kinds: { triggers: 'Triggers', conditions: 'Conditions', actions: 'Actions' },
    kind: { triggers: 'Trigger', conditions: 'Condition', actions: 'Action' },
    topics: {
      control: 'Control and modes',
      temperatures: 'Temperatures, faults and alerts',
      energy: 'Energy and efficiency (COP)',
      prices: 'Energy prices',
      adaptive: 'Adaptive control and building model',
      external: 'External data',
      calculators: 'Calculators',
      modbus: 'Modbus registers',
    },
    tokens: 'Tokens',
    example: 'Example',
    deprecated: 'Deprecated: no longer available for new flows.',
    noExample: 'Example to follow.',
    number: 'number',
    text: 'text',
    choice: 'choice from a list',
    yesNo: 'yes/no',
    to: 'to',
  },
  de: {
    title: 'Flow-Karten: Nachschlagewerk',
    intro: [
      'Dieses Nachschlagewerk beschreibt jede Flow-Karte der App: was die Karte tut, für welche Treiber sie existiert, ihre Felder und ein Beispiel.',
      'Es wird aus den Karten der App erzeugt; bitte nicht von Hand bearbeiten.',
      'Karten mit über oder unter und einem Schwellenwert lösen bei jeder Messung aus, die sich ausreichend '
        + 'ändert, solange der Wert die Bedingung erfüllt, also nicht einmalig beim Überschreiten. Sendet eine '
        + 'solche Karte eine Benachrichtigung, verwenden Sie eine Ja/Nein-Variable, um Wiederholungen zu vermeiden '
        + '(siehe das Beispiel beim Wasserdurchfluss-Alarm).',
      'Eine ausführliche Einführung mit Szenarien steht in [FLOW_CARDS_GUIDE.de.md](FLOW_CARDS_GUIDE.de.md).',
    ],
    contents: 'Inhalt',
    kinds: { triggers: 'Auslöser', conditions: 'Bedingungen', actions: 'Aktionen' },
    kind: { triggers: 'Auslöser', conditions: 'Bedingung', actions: 'Aktion' },
    topics: {
      control: 'Bedienung und Modi',
      temperatures: 'Temperaturen, Störungen und Alarme',
      energy: 'Energie und Effizienz (COP)',
      prices: 'Energiepreise',
      adaptive: 'Adaptive Regelung und Gebäudemodell',
      external: 'Externe Daten',
      calculators: 'Rechenhilfen',
      modbus: 'Modbus-Register',
    },
    tokens: 'Tokens',
    example: 'Beispiel',
    deprecated: 'Veraltet: in neuen Flows nicht mehr wählbar.',
    noExample: 'Beispiel folgt.',
    number: 'Zahl',
    text: 'Text',
    choice: 'Auswahl aus einer Liste',
    yesNo: 'ja/nein',
    to: 'bis',
  },
  fr: {
    title: 'Cartes Flow : référence',
    intro: [
      'Cette référence décrit chaque carte Flow de l\'application : ce que fait la carte, pour quels pilotes elle existe, ses champs et un exemple.',
      'Elle est générée à partir des cartes de l\'application ; ne pas la modifier à la main.',
      'Les cartes avec au-dessus ou en dessous et un seuil se déclenchent à chaque mesure qui change '
        + 'suffisamment tant que la valeur remplit la condition, donc pas une seule fois au franchissement du '
        + 'seuil. Si une telle carte envoie une notification, utilisez une variable Oui/Non pour éviter les '
        + 'répétitions (voir l\'exemple de l\'alerte de débit d\'eau).',
      'Une introduction détaillée avec des scénarios se trouve dans [FLOW_CARDS_GUIDE.fr.md](FLOW_CARDS_GUIDE.fr.md).',
    ],
    contents: 'Sommaire',
    kinds: { triggers: 'Déclencheurs', conditions: 'Conditions', actions: 'Actions' },
    kind: { triggers: 'Déclencheur', conditions: 'Condition', actions: 'Action' },
    topics: {
      control: 'Commande et modes',
      temperatures: 'Températures, défauts et alertes',
      energy: 'Énergie et rendement (COP)',
      prices: 'Prix de l\'énergie',
      adaptive: 'Contrôle adaptatif et modèle de bâtiment',
      external: 'Données externes',
      calculators: 'Outils de calcul',
      modbus: 'Registres Modbus',
    },
    tokens: 'Tokens',
    example: 'Exemple',
    deprecated: 'Obsolète : n\'est plus disponible dans les nouveaux Flows.',
    noExample: 'Exemple à venir.',
    number: 'nombre',
    text: 'texte',
    choice: 'choix dans une liste',
    yesNo: 'oui/non',
    to: 'à',
  },
};

/** Card ID without the driver suffix. */
function baseId(id) {
  return id.replace(/_(modbus|aurora3)$/, '');
}

/** Topic of a card function, or null when it is not mapped. */
function topicOf(base) {
  return TOPIC_ORDER.find((topic) => TOPICS[topic].includes(base)) || null;
}

/** Localized string with English as fallback. */
function loc(value, lang) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.en || '';
}

/** Drivers a card is filtered on (driver_id=a|b). */
function driversOf(card) {
  const device = (card.args || []).find((arg) => arg.type === 'device');
  const match = device && typeof device.filter === 'string' && device.filter.match(/driver_id=([^&]+)/);
  return match ? match[1].split('|') : [];
}

/**
 * The card functions of app.json: one entry per base ID and kind, with the card of the first
 * driver as source for the title, all drivers combined, and every driver's card as a variant
 * (hints and fields can differ per driver).
 */
function collectFunctions(app) {
  const functions = [];
  for (const kind of KINDS) {
    const byBase = new Map();
    for (const card of (app.flow && app.flow[kind]) || []) {
      const base = baseId(card.id);
      if (!byBase.has(base)) {
        byBase.set(base, {
          kind, base, card, ids: [], drivers: [], variants: [],
        });
      }
      const entry = byBase.get(base);
      entry.ids.push(card.id);
      entry.variants.push({ card, drivers: driversOf(card) });
      for (const driver of driversOf(card)) {
        if (!entry.drivers.includes(driver)) entry.drivers.push(driver);
      }
    }
    functions.push(...byBase.values());
  }
  return functions;
}

/** Short description of the values an argument accepts. */
function describeArg(arg, lang) {
  const t = TEXT[lang];
  // Dropdown values carry their text as `title` or `label`; both occur in app.json.
  if (arg.type === 'dropdown') return (arg.values || []).map((v) => loc(v.label || v.title, lang) || v.id).join(', ');
  if (arg.type === 'checkbox') return t.yesNo;
  if (arg.type === 'number' || arg.type === 'range') {
    const unit = arg.units ? ` ${loc(arg.units, lang)}` : '';
    const min = arg.min ?? (arg.settings && arg.settings.min);
    const max = arg.max ?? (arg.settings && arg.settings.max);
    if (min !== undefined && max !== undefined) return `${t.number}, ${min} ${t.to} ${max}${unit}`;
    return `${t.number}${unit}`;
  }
  if (arg.type === 'autocomplete') return t.choice;
  return t.text;
}

/** Greedy word wrap at 80 columns; continuation lines get `indent`. */
function wrap(text, indent = '', width = 80) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const prefix = lines.length ? indent : '';
    if (line && prefix.length + line.length + 1 + word.length > width) {
      // A line must not start with "-" or "1." (it would become a list): carry the previous word along.
      const carry = /^([-*+]|\d+[.)])$/.test(word) && line.includes(' ') ? line.slice(line.lastIndexOf(' ') + 1) : '';
      lines.push(prefix + (carry ? line.slice(0, line.lastIndexOf(' ')) : line));
      line = carry ? `${carry} ${word}` : word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push((lines.length ? indent : '') + line);
  return lines;
}

/** Driver names in readme order. */
function driverList(ids, lang, driverNames) {
  return [...ids]
    .sort((a, b) => DRIVER_ORDER.indexOf(a) - DRIVER_ORDER.indexOf(b))
    .map((id) => loc(driverNames[id], lang) || id);
}

/** Groups the variants by a text derived from each card: [{ text, drivers }], in first-seen order. */
function groupVariants(fn, textOf) {
  const groups = [];
  for (const { card, drivers } of fn.variants) {
    const text = textOf(card);
    if (!text) continue;
    let group = groups.find((g) => g.text === text);
    if (!group) {
      group = { text, drivers: [] };
      groups.push(group);
    }
    group.drivers.push(...drivers);
  }
  return groups;
}

function renderFunction(fn, lang, examples, driverNames, heading) {
  const t = TEXT[lang];
  const { card } = fn;
  const lines = [];
  lines.push(`#### ${heading}`, '');
  lines.push(...wrap([`**${t.kind[fn.kind]}**`, ...driverList(fn.drivers, lang, driverNames)].join(' · ')), '');
  if (fn.variants.every((variant) => variant.card.deprecated)) lines.push(`**${t.deprecated}**`, '');

  // Hints and fields that differ per driver are shown once per group of drivers.
  const hints = groupVariants(fn, (variant) => loc(variant.hint, lang));
  for (const hint of hints) {
    const prefix = hints.length > 1 ? `${driverList(hint.drivers, lang, driverNames).join(', ')}: ` : '';
    lines.push(...wrap(`${prefix}${hint.text}`), '');
  }

  const args = (card.args || []).filter((arg) => arg.type !== 'device');
  if (args.length) {
    for (const arg of args) {
      const title = loc(arg.title, lang) || arg.name;
      const groups = groupVariants(fn, (variant) => {
        const own = (variant.args || []).find((a) => a.name === arg.name);
        return own ? describeArg(own, lang) : '';
      });
      for (const group of groups) {
        const drivers = groups.length > 1 ? ` (${driverList(group.drivers, lang, driverNames).join(', ')})` : '';
        lines.push(...wrap(`- ${title}${drivers}: ${group.text}`, '  '));
      }
    }
    lines.push('');
  }

  const tokens = (card.tokens || []).map((token) => loc(token.title, lang) || token.name);
  if (tokens.length) lines.push(...wrap(`${t.tokens}: ${tokens.join(', ')}`), '');

  const example = examples[fn.base];
  if (example && example.text) {
    lines.push(...wrap(`**${t.example}:** ${example.text}`), '');
    if (Array.isArray(example.flow) && example.flow.length) {
      lines.push('```text', ...example.flow, '```', '');
    }
  } else {
    lines.push(t.noExample, '');
  }
  return lines;
}

/** Anchor of a heading as GitHub makes it: lower case, punctuation removed, spaces to hyphens. */
function slug(text) {
  return text.toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .trim()
    .replace(/ /g, '-');
}

function render(app, lang, examples) {
  const t = TEXT[lang];
  const driverNames = Object.fromEntries((app.drivers || []).map((driver) => [driver.id, driver.name]));
  const functions = collectFunctions(app);
  const lines = [`# ${t.title}`, '', ...t.intro.flatMap((line) => [...wrap(line), '']), `## ${t.contents}`, ''];
  const headings = new Set(KINDS.map((kind) => t.kinds[kind]));
  for (const kind of KINDS) {
    lines.push(`- [${t.kinds[kind]}](#${slug(t.kinds[kind])})`);
  }
  lines.push('');
  for (const kind of KINDS) {
    lines.push(`## ${t.kinds[kind]}`, '');
    for (const topic of TOPIC_ORDER) {
      const inTopic = functions.filter((fn) => fn.kind === kind && topicOf(fn.base) === topic);
      if (!inTopic.length) continue;
      lines.push(`### ${t.kinds[kind]}: ${t.topics[topic]}`, '');
      inTopic.sort((a, b) => loc(a.card.title, lang).localeCompare(loc(b.card.title, lang), lang));
      for (const fn of inTopic) {
        // Headings must be unique; a title used before gets the kind added.
        // A title may hold Homey's !{{is|is not}} syntax; the heading shows the first option.
        let heading = loc(fn.card.title, lang).replace(/!\{\{([^|}]*)\|[^}]*\}\}/g, '$1');
        if (headings.has(heading)) heading = `${heading} (${t.kind[fn.kind]})`;
        headings.add(heading);
        lines.push(...renderFunction(fn, lang, examples, driverNames, heading));
      }
    }
  }
  while (lines[lines.length - 1] === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

function readExamples(lang) {
  const file = path.join(EXAMPLES_DIR, `${lang}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

function outputFile(lang) {
  return path.join(GUIDE_DIR, `FLOW_CARDS_REFERENCE.${lang}.md`);
}

function readApp() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
}

function main() {
  const check = process.argv.includes('--check');
  const app = readApp();
  const functions = collectFunctions(app);
  let stale = 0;
  for (const lang of LANGS) {
    const examples = readExamples(lang);
    const content = render(app, lang, examples);
    const file = outputFile(lang);
    const missing = functions.filter((fn) => !(examples[fn.base] && examples[fn.base].text)).length;
    if (check) {
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (current !== content) {
        stale += 1;
        console.error(`${path.relative(ROOT, file)} is out of date; run node scripts/docs/flow-reference.js`);
      }
    } else {
      fs.writeFileSync(file, content);
    }
    console.log(`${lang}: ${functions.length} functions, ${missing} without example`);
  }
  if (stale) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  LANGS, TOPICS, baseId, topicOf, collectFunctions, render, readExamples, readApp, outputFile,
};
