/* global document, window, localStorage */
/* eslint-disable no-use-before-define, max-len */

'use strict';

(() => {
  const SVG_TEMPLATE = [
    '<svg class="schema-svg" viewBox="0 54 1480 1510" xmlns="http://www.w3.org/2000/svg">',
    '  <defs>',
    '    <!-- Native Adlar Dashboard Palette (var(--c-surface-inner) / var(--c-nav-bg) / var(--c-border)) -->',
    '    <linearGradient id="bgMain" x1="0" y1="0" x2="0" y2="1">',
    '      <stop offset="0%" stop-color="var(--c-bg-top)"/>',
    '      <stop offset="50%" stop-color="var(--c-surface-inner)"/>',
    '      <stop offset="100%" stop-color="var(--c-bg-deep)"/>',
    '    </linearGradient>',
    '    <linearGradient id="cardSurface" x1="0" y1="0" x2="0" y2="1">',
    '      <stop offset="0%" stop-color="var(--c-card-top)"/>',
    '      <stop offset="100%" stop-color="var(--c-card-bot)"/>',
    '    </linearGradient>',
    '    <linearGradient id="zoneRefrig" x1="0" y1="0" x2="1" y2="1">',
    '      <stop offset="0%" stop-color="var(--c-zone-refrig-1)"/>',
    '      <stop offset="100%" stop-color="var(--c-zone-refrig-2)"/>',
    '    </linearGradient>',
    '    <linearGradient id="zoneHydro" x1="0" y1="0" x2="1" y2="1">',
    '      <stop offset="0%" stop-color="var(--c-zone-hydro-1)"/>',
    '      <stop offset="100%" stop-color="var(--c-zone-hydro-2)"/>',
    '    </linearGradient>',
    '    <linearGradient id="sankeyEnv" x1="0" y1="0" x2="1" y2="0">',
    '      <stop offset="0%" stop-color="var(--c-sky)" stop-opacity="0.55"/>',
    '      <stop offset="100%" stop-color="var(--c-green)" stop-opacity="0.65"/>',
    '    </linearGradient>',
    '    <linearGradient id="sankeyElec" x1="0" y1="0" x2="1" y2="0">',
    '      <stop offset="0%" stop-color="var(--c-amber-light)" stop-opacity="0.65"/>',
    '      <stop offset="100%" stop-color="var(--c-green)" stop-opacity="0.65"/>',
    '    </linearGradient>',
    '    <linearGradient id="sankeyOut" x1="0" y1="0" x2="1" y2="0">',
    '      <stop offset="0%" stop-color="var(--c-green)" stop-opacity="0.65"/>',
    '      <stop offset="100%" stop-color="var(--c-orange)" stop-opacity="0.75"/>',
    '    </linearGradient>',
    '    <linearGradient id="hxGrad" x1="0" y1="0" x2="1" y2="0">',
    '      <stop offset="0%" stop-color="var(--c-red)" stop-opacity="0.35"/>',
    '      <stop offset="50%" stop-color="var(--c-text-sec)" stop-opacity="0.25"/>',
    '      <stop offset="100%" stop-color="var(--c-orange)" stop-opacity="0.35"/>',
    '    </linearGradient>',
    '    <linearGradient id="dhwGrad" x1="0" y1="0" x2="0" y2="1">',
    '      <stop offset="0%" stop-color="#ea580c" stop-opacity="0.8"/>',
    '      <stop offset="65%" stop-color="#d97706" stop-opacity="0.5"/>',
    '      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.55"/>',
    '    </linearGradient>',
    '    <linearGradient id="compArea" x1="0" y1="0" x2="0" y2="1">',
    '      <stop offset="0%" stop-color="var(--c-sky)" stop-opacity="0.22"/>',
    '      <stop offset="100%" stop-color="var(--c-sky)" stop-opacity="0.0"/>',
    '    </linearGradient>',
    '  </defs>',
    '',
    '  <!-- Main Background -->',
    '  <rect x="0" y="0" width="1480" height="1580" fill="url(#bgMain)" stroke="none"/>',
    '',
    '  <!-- ==================== PAGE TITLE & STATUS BAR ==================== -->',
    '  <text x="28" y="88" fill="var(--c-text-h1)" font-family="sans-serif" font-size="24" font-weight="800" id="sc-title">Adlar Castra Aurora II — Thermodynamisch &amp; Hydronisch Processchema</text>',
    '  <text x="28" y="108" fill="var(--c-text-label)" font-family="sans-serif" font-size="13">Koppeling EVI-koudemiddelcyclus (T1–T9) · Waterzijdige distributie · 1R1C-Gebouwmodel &amp; Adaptieve PI-Regelaar</text>',
    '',
    '  <!-- Active Mode Chips Right -->',
    '  <rect x="1030" y="72" width="144" height="28" rx="6" fill="var(--c-tint-orange)" stroke="var(--c-orange)" stroke-width="1.2"/>',
    '  <circle cx="1046" cy="86" r="4" fill="var(--c-orange)" stroke="none"/>',
    '  <text x="1058" y="90" fill="var(--c-orange-pale)" font-family="sans-serif" font-size="12" font-weight="700" id="sc-chip-mode">Modus: Verwarmen</text>',
    '',
    '  <rect x="1182" y="72" width="132" height="28" rx="6" fill="var(--c-tint-blue-2)" stroke="var(--c-sky)" stroke-width="1.2"/>',
    '  <text x="1248" y="90" fill="var(--c-sky-light)" font-family="sans-serif" font-size="12" font-weight="700" text-anchor="middle" id="sc-chip-curve">Stooklijn: L4 + PI</text>',
    '',
    '  <rect x="1322" y="72" width="130" height="28" rx="6" fill="var(--c-tint-green-2)" stroke="var(--c-green)" stroke-width="1.2"/>',
    '  <text x="1387" y="90" fill="var(--c-green-light)" font-family="sans-serif" font-size="12" font-weight="700" text-anchor="middle" id="sc-chip-evi">EVI-Injectie: Aan</text>',
    '',
    '',
    '  <!-- ==================== LAAG 1: ADLAR KPI CARDS (LINKS) + SANKEY ENERGIEBRUG (RECHTS) ==================== -->',
    '  <text x="28" y="138" fill="var(--c-sky-sec)" font-family="sans-serif" font-size="12" font-weight="700" letter-spacing="1">LIVE KERNWAARDEN &amp; THERMODYNAMISCHE ENERGIEBALANS</text>',
    '  <line x1="28" y1="146" x2="1452" y2="146" stroke="var(--c-border)" stroke-width="1"/>',
    '',
    '  <!-- 6 KPI Cards (2 rows x 3 cols on the left, x=28..788) -->',
    '  <!-- Card 1: Realtime COP -->',
    '  <rect x="28" y="158" width="244" height="92" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="28" y="158" width="5" height="92" rx="2.5" fill="var(--c-green)" stroke="none"/>',
    '  <text x="46" y="178" fill="var(--c-text-label)" font-family="sans-serif" font-size="10.5" font-weight="700" letter-spacing="0.6" id="sc-cop-label">REALTIME COP</text>',
    '  <text id="sc-kpi-cop" x="46" y="214" fill="var(--c-green)" font-family="sans-serif" font-size="32" font-weight="800">4,35</text>',
    '  <text x="132" y="204" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5" font-weight="600" id="sc-kpi-scop">SCOP: 4,12</text>',
    '  <text x="132" y="220" fill="var(--c-text-label)" font-family="sans-serif" font-size="11" id="sc-kpi-cop24">24u-gem: 4,18</text>',
    '  <text id="sc-cop-raw" x="46" y="239" fill="var(--c-amber-light)" font-family="sans-serif" font-size="10"></text>',
    '  <polyline points="46,238 80,235 115,239 150,232 185,230 220,227 254,225" fill="none" stroke="var(--c-green)" stroke-width="1.8"/>',
    '',
    '  <!-- Card 2: Compressor & Drive -->',
    '  <rect x="284" y="158" width="244" height="92" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="284" y="158" width="5" height="92" rx="2.5" fill="var(--c-sky)" stroke="none"/>',
    '  <text x="302" y="178" fill="var(--c-text-label)" font-family="sans-serif" font-size="10.5" font-weight="700" letter-spacing="0.6">COMPRESSOR (0x0040 / 0x0027)</text>',
    '  <text id="sc-kpi-comp-hz" x="302" y="212" fill="var(--c-text-main)" font-family="sans-serif" font-size="28" font-weight="800">48 <tspan font-size="14" fill="var(--c-text-label)" font-weight="600">Hz</tspan></text>',
    '  <text x="404" y="202" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5" font-weight="600" id="sc-kpi-comp-target">Doel: 48 Hz</text>',
    '  <text x="404" y="218" fill="var(--c-text-label)" font-family="sans-serif" font-size="11" id="sc-kpi-comp-ipm">IPM: 44,2 °C · 5,8 A</text>',
    '  <rect x="302" y="230" width="210" height="7" rx="3.5" fill="var(--c-border)" stroke="none"/>',
    '  <rect id="sc-kpi-comp-bar" x="302" y="230" width="118" height="7" rx="3.5" fill="var(--c-sky)" stroke="none"/>',
    '',
    '  <!-- Card 3: Waterdebiet & PWM Pomp -->',
    '  <rect x="540" y="158" width="244" height="92" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="540" y="158" width="5" height="92" rx="2.5" fill="var(--c-teal)" stroke="none"/>',
    '  <text x="558" y="178" fill="var(--c-text-label)" font-family="sans-serif" font-size="10.5" font-weight="700" letter-spacing="0.6">DEBIET &amp; WATERPOMP (0x0058)</text>',
    '  <text id="sc-kpi-flow" x="558" y="212" fill="var(--c-text-main)" font-family="sans-serif" font-size="28" font-weight="800">17,8 <tspan font-size="14" fill="var(--c-text-label)" font-weight="600">L/min</tspan></text>',
    '  <text x="682" y="202" fill="var(--c-teal)" font-family="sans-serif" font-size="11.5" font-weight="600" id="sc-kpi-pwm">PWM: 65 %</text>',
    '  <text x="682" y="218" fill="var(--c-text-label)" font-family="sans-serif" font-size="11" id="sc-kpi-dt">ΔT: 5,0 K</text>',
    '  <rect x="558" y="230" width="210" height="7" rx="3.5" fill="var(--c-border)" stroke="none"/>',
    '  <rect id="sc-kpi-flow-bar" x="558" y="230" width="136" height="7" rx="3.5" fill="var(--c-teal)" stroke="none"/>',
    '',
    '  <!-- Card 4: Aanvoer T7 & Retour T6 -->',
    '  <rect x="28" y="260" width="244" height="92" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="28" y="260" width="5" height="92" rx="2.5" fill="var(--c-orange)" stroke="none"/>',
    '  <text x="46" y="280" fill="var(--c-text-label)" font-family="sans-serif" font-size="10.5" font-weight="700" letter-spacing="0.6">WATER AANVOER (T7) / RETOUR (T6)</text>',
    '  <text id="sc-kpi-t7t6" x="46" y="314" fill="var(--c-text-main)" font-family="sans-serif" font-size="26" font-weight="800">35,2° <tspan fill="var(--c-text-label)" font-size="18">/</tspan> <tspan fill="var(--c-sky)">30,2°</tspan></text>',
    '  <polyline points="46,338 80,334 115,336 150,331 185,333 220,330 254,332" fill="none" stroke="var(--c-orange)" stroke-width="1.8"/>',
    '',
    '  <!-- Card 5: Buiten T1 & Verdamper -->',
    '  <rect x="284" y="260" width="244" height="92" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="284" y="260" width="5" height="92" rx="2.5" fill="var(--c-sky-sec)" stroke="none"/>',
    '  <text x="302" y="280" fill="var(--c-text-label)" font-family="sans-serif" font-size="10.5" font-weight="700" letter-spacing="0.6">BUITEN (T1) &amp; FAN (0x0041)</text>',
    '  <text id="sc-kpi-t1" x="302" y="314" fill="var(--c-text-main)" font-family="sans-serif" font-size="28" font-weight="800">7,4 <tspan font-size="14" fill="var(--c-text-label)" font-weight="600">°C</tspan></text>',
    '  <text x="404" y="304" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5" font-weight="600" id="sc-kpi-fan">Fan: 540 RPM</text>',
    '  <text x="404" y="320" fill="var(--c-text-label)" font-family="sans-serif" font-size="11" id="sc-kpi-t2">Coil T2: 3,8 °C</text>',
    '  <polyline points="302,338 336,341 370,339 405,334 440,331 475,333 512,335" fill="none" stroke="var(--c-sky-sec)" stroke-width="1.8"/>',
    '',
    '  <!-- Card 6: Woonkamer & Gebouwmodel -->',
    '  <rect x="540" y="260" width="244" height="92" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="540" y="260" width="5" height="92" rx="2.5" fill="var(--c-purple)" stroke="none"/>',
    '  <text x="558" y="280" fill="var(--c-text-label)" font-family="sans-serif" font-size="10.5" font-weight="700" letter-spacing="0.6">WOONKAMER &amp; ADAPTIEF MODEL</text>',
    '  <text id="sc-kpi-room" x="558" y="314" fill="var(--c-text-main)" font-family="sans-serif" font-size="28" font-weight="800">20,6 <tspan font-size="14" fill="var(--c-text-label)" font-weight="600">°C</tspan></text>',
    '  <text x="668" y="304" fill="var(--c-purple-light)" font-family="sans-serif" font-size="11.5" font-weight="600" id="sc-kpi-room-target">Doel: 20,5 °C</text>',
    '  <text x="668" y="320" fill="var(--c-text-label)" font-family="sans-serif" font-size="11" id="sc-kpi-tau">τ = 67,4 u (88%)</text>',
    '  <polyline points="558,336 600,336 640,335 680,336 720,336 768,335" fill="none" stroke="var(--c-purple)" stroke-width="1.8"/>',
    '',
    '',
    '  <!-- Right Side of Layer 1: SANKEY THERMODYNAMISCHE ENERGIEBRUG (x=800..1452, y=158..352) -->',
    '  <rect x="800" y="158" width="652" height="194" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <text x="820" y="180" fill="var(--c-sky-sec)" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="0.6">SANKEY ENERGIEBRUG — BRONWARMTE + ELEKTRISCH = THERMISCH</text>',
    '  <text x="1432" y="180" fill="var(--c-text-label)" font-family="sans-serif" font-size="11" text-anchor="end" id="sc-sankey-price">€ 0,21/kWh_el → € 0,048/kWh_th</text>',
    '',
    '  <!-- Sankey Flow Shapes -->',
    '  <!-- Top Input Band: Omgevingswarmte 4.76 kW (77% height = 54px) -->',
    '  <path d="M 984 198 C 1050 198, 1060 218, 1115 218 L 1115 272 C 1060 272, 1050 252, 984 252 Z" fill="url(#sankeyEnv)" stroke="var(--c-sky)" stroke-width="1"/>',
    '  <!-- Bottom Input Band: Elektrisch 1.42 kW (23% height = 18px) -->',
    '  <path d="M 984 286 C 1050 286, 1060 272, 1115 272 L 1115 290 C 1060 290, 1050 304, 984 304 Z" fill="url(#sankeyElec)" stroke="var(--c-amber-light)" stroke-width="1"/>',
    '  <!-- Combined Output Band: Thermisch 6.18 kW (100% height = 72px) -->',
    '  <path d="M 1155 218 L 1275 218 L 1275 290 L 1155 290 Z" fill="url(#sankeyOut)" stroke="var(--c-green)" stroke-width="1"/>',
    '',
    '  <!-- Center Mixer Node (Compressor / Cyclus) -->',
    '  <rect x="1108" y="210" width="54" height="88" rx="8" fill="var(--c-surface-inner)" stroke="var(--c-green)" stroke-width="2"/>',
    '  <text x="1135" y="244" fill="var(--c-text-label)" font-family="sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">FACTOR</text>',
    '  <text x="1135" y="264" fill="var(--c-green)" font-family="sans-serif" font-size="16" font-weight="800" text-anchor="middle" id="sc-sankey-cop">×4,35</text>',
    '  <text x="1135" y="282" fill="var(--c-text-main)" font-family="sans-serif" font-size="9.5" text-anchor="middle">COP</text>',
    '',
    '  <!-- Left Labels for Sankey -->',
    '  <rect x="820" y="196" width="160" height="58" rx="7" fill="var(--c-surface-inner)" stroke="var(--c-border-strong)" stroke-width="1.2"/>',
    '  <text x="832" y="214" fill="var(--c-sky)" font-family="sans-serif" font-size="10.5" font-weight="700">1. Buitenlucht (Verdamper)</text>',
    '  <text id="sc-sankey-env" x="832" y="235" fill="var(--c-text-main)" font-family="sans-serif" font-size="18" font-weight="800">4,76 kW <tspan font-size="11" fill="var(--c-sky)" font-weight="600">(77%)</tspan></text>',
    '  <text x="832" y="248" fill="var(--c-text-label)" font-family="sans-serif" font-size="10">Hernieuwbare bronwarmte</text>',
    '',
    '  <rect x="820" y="264" width="160" height="58" rx="7" fill="var(--c-surface-inner)" stroke="var(--c-tint-amber)" stroke-width="1.2"/>',
    '  <text x="832" y="282" fill="var(--c-amber-light)" font-family="sans-serif" font-size="10.5" font-weight="700" id="sc-power-label">2. Elektrisch</text>',
    '  <text id="sc-sankey-elec" x="832" y="303" fill="var(--c-text-main)" font-family="sans-serif" font-size="18" font-weight="800">1,42 kW <tspan font-size="11" fill="var(--c-amber-light)" font-weight="600">(23%)</tspan></text>',
    '  <text x="832" y="316" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" id="sc-sankey-elec-sub">231 V · 6,2 A · Totaal 1.184 kWh</text>',
    '',
    '  <!-- Right Label for Sankey Output -->',
    '  <rect x="1280" y="210" width="154" height="88" rx="8" fill="var(--c-surface-inner)" stroke="var(--c-orange)" stroke-width="1.5"/>',
    '  <text x="1292" y="230" fill="var(--c-orange)" font-family="sans-serif" font-size="11" font-weight="700">3. Thermische Afgifte</text>',
    '  <text x="1292" y="256" fill="var(--c-text-strong)" font-family="sans-serif" font-size="22" font-weight="800" id="sc-sankey-th">6,18 kW_th</text>',
    '  <text x="1292" y="274" fill="var(--c-teal)" font-family="sans-serif" font-size="11" font-weight="600" id="sc-sankey-th-sub">17,8 L/min × ΔT 5,0 K</text>',
    '  <text x="1292" y="290" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" id="sc-sankey-th-total">Totaal geleverd: 4.820 kWh</text>',
    '',
    '  <text id="sc-sankey-footer" x="820" y="340" fill="var(--c-text-label)" font-family="sans-serif" font-size="10.5">',
    '    Vermogensbron: <tspan fill="var(--c-text-main)" font-weight="600">Externe kWh-meter (1.420 W)</tspan> + Modbus 0x0045 (marnie-gekalibreerd) · Actuele uurprijs: <tspan fill="var(--c-green-light)" font-weight="600">€ 0,30/u</tspan>',
    '  </text>',
    '',
    '',
    '  <!-- ==================== LAAG 2: TWEELUIK PROCESSCHEMA (KOUDEMIDDELKRINGLOOP <-> WATERKRINGLOOP) ==================== -->',
    '  <text x="28" y="382" fill="var(--c-sky-sec)" font-family="sans-serif" font-size="12" font-weight="700" letter-spacing="1">SYSTEEMARCHITECTUUR — I. EVI KOUDEMIDDELKRINGLOOP (LINKS)  ⇄  II. HYDRONISCHE AFGIFTE &amp; GEBOUWMODEL (RECHTS)</text>',
    '  <line x1="28" y1="390" x2="1452" y2="390" stroke="var(--c-border)" stroke-width="1"/>',
    '',
    '  <!-- Outer Container for Split Schematic -->',
    '  <rect x="28" y="402" width="1424" height="670" rx="12" fill="var(--c-card-bot)" stroke="var(--c-border)" stroke-width="1.2"/>',
    '',
    '  <!-- Zone I Background (Left: Refrigerant Loop, x=44..645) -->',
    '  <rect x="44" y="418" width="600" height="600" rx="10" fill="url(#zoneRefrig)" stroke="var(--c-border-strong)" stroke-width="1.2"/>',
    '  <rect x="60" y="432" width="320" height="26" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-border-strong)" stroke-width="1"/>',
    '  <text x="72" y="449" fill="var(--c-sky)" font-family="sans-serif" font-size="11.5" font-weight="700">ZONE I · EVI KOUDEMIDDELCYCLUS (R32 / R290)</text>',
    '',
    '  <!-- Zone II Background (Right: Hydronic Loop & Building Model, x=755..1436) -->',
    '  <rect x="756" y="418" width="680" height="600" rx="10" fill="url(#zoneHydro)" stroke="var(--c-border)" stroke-width="1.2"/>',
    '  <rect x="772" y="432" width="365" height="26" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <text x="784" y="449" fill="var(--c-orange)" font-family="sans-serif" font-size="11.5" font-weight="700">ZONE II · HYDRONISCH CIRCUIT &amp; 1R1C-GEBOUWMODEL</text>',
    '',
    '',
    '  <!-- ==================== ZONE I: THERMODYNAMIC REFRIGERANT CYCLE ==================== -->',
    '  <!-- Refrigerant Loop Pipes (Clockwise cycle: Evaporator [left] -> Compressor [top] -> Condenser [right bridge] -> EVI Economizer [center] -> EEV [bottom] -> Evaporator) -->',
    '',
    '  <!-- 1. Suction Gas Line (Low pressure cold gas: Evaporator top -> Compressor left) -->',
    '  <path id="sc-pipe-suction" class="schema-pipe-anim flow-active" d="M 155 595 L 155 515 L 270 515" fill="none" stroke="var(--c-sky)" stroke-width="4"/>',
    '  <!-- Arrows on Suction line -->',
    '  <polygon points="150,555 155,543 160,555" fill="var(--c-sky-light)" stroke="none"/>',
    '  <polygon points="220,510 232,515 220,520" fill="var(--c-sky-light)" stroke="none"/>',
    '  <!-- Sensor tag T4 Suction -->',
    '  <rect x="168" y="476" width="90" height="30" rx="5" fill="var(--c-surface-inner)" stroke="var(--c-sky)" stroke-width="1"/>',
    '  <text x="213" y="490" fill="var(--c-sky-light)" font-family="sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">ZUIGGAS T4</text>',
    '  <text x="213" y="502" fill="var(--c-text-strong)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="middle" id="sc-z1-t4">5,1 °C (0x004D)</text>',
    '',
    '  <!-- 2. Hot Discharge Gas Line (High pressure hot gas: Compressor right -> Plate Condenser top-left) -->',
    '  <path id="sc-pipe-discharge" class="schema-pipe-anim flow-active" d="M 450 515 L 655 515 L 655 575" fill="none" stroke="var(--c-red)" stroke-width="4.5"/>',
    '  <polygon points="555,510 567,515 555,520" fill="var(--c-red-light)" stroke="none"/>',
    '  <!-- Sensor tag T5 Exhaust -->',
    '  <rect x="475" y="476" width="118" height="30" rx="5" fill="var(--c-surface-inner)" stroke="var(--c-red)" stroke-width="1"/>',
    '  <text x="534" y="490" fill="var(--c-red-light)" font-family="sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">PERSGAS T5 (HEETGAS)</text>',
    '  <text x="534" y="502" fill="var(--c-text-strong)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="middle" id="sc-z1-t5">68,4 °C (0x004E)</text>',
    '',
    '  <!-- 3. Subcooled Liquid Line (Plate Condenser bottom-left -> EVI Subcooler -> EEV) -->',
    '  <path id="sc-pipe-liquid" class="schema-pipe-anim flow-active" d="M 655 785 L 655 835 L 430 835 L 430 925 L 405 925" fill="none" stroke="var(--c-amber)" stroke-width="4"/>',
    '  <polygon points="565,830 553,835 565,840" fill="var(--c-amber-pale)" stroke="none"/>',
    '',
    '  <!-- 4. EVI Bypass Branch (Liquid split -> EVI Expansion Valve 0x0043 -> Economizer HX -> Vapor Injection into Compressor) -->',
    '  <path d="M 515 835 L 515 725 L 435 725" fill="none" stroke="var(--c-orange-light)" stroke-width="2.5" stroke-dasharray="5 3"/>',
    '  <!-- Medium-pressure vapor injection up into Compressor -->',
    '  <path d="M 360 665 L 360 565" fill="none" stroke="var(--c-purple-light)" stroke-width="3" stroke-dasharray="5 3"/>',
    '  <polygon points="355,610 360,598 365,610" fill="var(--c-purple-soft)" stroke="none"/>',
    '',
    '  <!-- 5. Two-Phase Low-Pressure Line after Main EEV (EEV left -> Evaporator bottom) -->',
    '  <path id="sc-pipe-twophase" class="schema-pipe-anim flow-active" d="M 305 925 L 155 925 L 155 795" fill="none" stroke="var(--c-teal)" stroke-width="4"/>',
    '  <polygon points="225,920 213,925 225,930" fill="var(--c-teal-pale)" stroke="none"/>',
    '  <polygon points="150,855 155,843 160,855" fill="var(--c-teal-pale)" stroke="none"/>',
    '',
    '',
    '  <!-- Component I-A (Top): DC Inverter Compressor (0x0040) -->',
    '  <rect x="270" y="472" width="180" height="92" rx="12" fill="var(--c-surface-inner)" stroke="var(--c-sky)" stroke-width="2"/>',
    '  <circle cx="312" cy="518" r="24" fill="var(--c-badge-slate)" stroke="var(--c-sky)" stroke-width="2"/>',
    '  <!-- Compressor symbol (trapezoid/piston) -->',
    '  <polygon points="298,530 306,502 318,502 326,530" fill="none" stroke="var(--c-sky-light)" stroke-width="2"/>',
    '  <text x="386" y="494" fill="var(--c-sky)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="middle">COMPRESSOR</text>',
    '  <text id="sc-z1-comp-hz" x="386" y="518" fill="var(--c-text-strong)" font-family="sans-serif" font-size="22" font-weight="800" text-anchor="middle">48 Hz</text>',
    '  <text x="386" y="535" fill="var(--c-text-main)" font-family="sans-serif" font-size="10.5" text-anchor="middle" id="sc-z1-comp-sub">Doel: 48 Hz · 5,8 A</text>',
    '  <text x="386" y="551" fill="var(--c-green-light)" font-family="sans-serif" font-size="10" font-weight="600" text-anchor="middle" id="sc-z1-ipm">IPM: 44,2 °C (0x0047)</text>',
    '',
    '  <!-- Saturation Temps Badge (0x0048 / 0x0049) -->',
    '  <rect x="255" y="574" width="92" height="44" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <text x="301" y="591" fill="var(--c-text-label)" font-family="sans-serif" font-size="9" font-weight="700" text-anchor="middle">DRUKVERZADIGING</text>',
    '  <text x="301" y="605" fill="var(--c-red-light)" font-family="sans-serif" font-size="9.5" font-weight="600" text-anchor="middle" id="sc-z1-sat">HD: 38,2° · LD: 2,9°</text>',
    '',
    '  <!-- Component I-B (Left): Verdamper & DC Ventilator (T1, T2, T3, 0x0041) -->',
    '  <rect x="70" y="595" width="170" height="200" rx="10" fill="var(--c-surface-inner)" stroke="var(--c-sky-sec)" stroke-width="1.8"/>',
    '  <text x="155" y="618" fill="var(--c-sky-sec)" font-family="sans-serif" font-size="12" font-weight="700" text-anchor="middle">VERDAMPER &amp; FAN</text>',
    '  <!-- Fan + Finned Coil Graphic -->',
    '  <circle cx="120" cy="668" r="28" fill="var(--c-nav-bg)" stroke="var(--c-border-pill)" stroke-width="2"/>',
    '  <ellipse cx="120" cy="651" rx="6" ry="11" fill="var(--c-sky)" stroke="none"/>',
    '  <ellipse cx="106" cy="677" rx="11" ry="6" fill="var(--c-sky)" stroke="none"/>',
    '  <ellipse cx="134" cy="677" rx="11" ry="6" fill="var(--c-sky)" stroke="none"/>',
    '  <circle cx="120" cy="668" r="5" fill="var(--c-text-main)" stroke="none"/>',
    '  <!-- Evaporator Coil Fins -->',
    '  <rect x="164" y="636" width="56" height="64" rx="4" fill="var(--c-badge-slate)" stroke="var(--c-sky)" stroke-width="1.2"/>',
    '  <line x1="176" y1="642" x2="176" y2="694" stroke="var(--c-sky-sec)" stroke-width="2"/>',
    '  <line x1="188" y1="642" x2="188" y2="694" stroke="var(--c-sky-sec)" stroke-width="2"/>',
    '  <line x1="200" y1="642" x2="200" y2="694" stroke="var(--c-sky-sec)" stroke-width="2"/>',
    '  <line x1="212" y1="642" x2="212" y2="694" stroke="var(--c-sky-sec)" stroke-width="2"/>',
    '',
    '  <text x="155" y="722" fill="var(--c-text-strong)" font-family="sans-serif" font-size="14" font-weight="800" text-anchor="middle" id="sc-z1-fan">540 RPM (36 Hz)</text>',
    '  <text id="sc-z1-t1" x="155" y="740" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" text-anchor="middle">Buitenlucht T1: <tspan fill="var(--c-sky)" font-weight="700">7,4 °C</tspan></text>',
    '  <text id="sc-z1-t2" x="155" y="757" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" text-anchor="middle">Outer Coil T2: <tspan font-weight="700">3,8 °C</tspan></text>',
    '  <text id="sc-z1-t3" x="155" y="773" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11" text-anchor="middle">Inner Coil T3: <tspan font-weight="700">4,2 °C</tspan></text>',
    '  <text x="155" y="788" fill="var(--c-green-light)" font-family="sans-serif" font-size="10" font-weight="600" text-anchor="middle" id="sc-z1-defrost">✓ Ontdooiing: Inactief (0x/24u)</text>',
    '',
    '  <!-- Component I-C (Center): EVI Economizer & EVI Valve (T8, T9, 0x0043) -->',
    '  <rect x="280" y="665" width="215" height="120" rx="10" fill="var(--c-surface-inner)" stroke="var(--c-purple-light)" stroke-width="1.6"/>',
    '  <text x="387" y="686" fill="var(--c-purple-light)" font-family="sans-serif" font-size="11.5" font-weight="700" text-anchor="middle">EVI ECONOMIZER (SUBCOOLER)</text>',
    '  <text id="sc-z1-t8" x="387" y="706" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" text-anchor="middle">Inlaat T8 (0x0051): <tspan fill="var(--c-text-strong)" font-weight="700">19,5 °C</tspan></text>',
    '  <text id="sc-z1-t9" x="387" y="723" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" text-anchor="middle">Uitlaat T9 (0x0052): <tspan fill="var(--c-text-strong)" font-weight="700">14,2 °C</tspan></text>',
    '  <rect x="298" y="736" width="180" height="36" rx="6" fill="var(--c-badge-slate)" stroke="var(--c-purple)" stroke-width="1"/>',
    '  <text x="388" y="752" fill="var(--c-purple-soft)" font-family="sans-serif" font-size="10.5" font-weight="700" text-anchor="middle" id="sc-z1-evi">EVI-Expansieklep (0x0043): 80 P</text>',
    '  <text x="388" y="766" fill="var(--c-text-muted)" font-family="sans-serif" font-size="9.5" text-anchor="middle">Tussendruk dampinjectie → Compressor</text>',
    '',
    '  <!-- Component I-D (Bottom): Main Electronic Expansion Valve EEV (0x0042) -->',
    '  <rect x="305" y="885" width="125" height="80" rx="10" fill="var(--c-surface-inner)" stroke="var(--c-teal)" stroke-width="1.8"/>',
    '  <!-- Bowtie expansion valve icon -->',
    '  <polygon points="347,903 367,915 347,927" fill="var(--c-teal)" stroke="none"/>',
    '  <polygon points="387,903 367,915 387,927" fill="var(--c-teal)" stroke="none"/>',
    '  <text x="367" y="944" fill="var(--c-teal)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="middle">HOOFD-EEV (0x0042)</text>',
    '  <text x="367" y="959" fill="var(--c-text-strong)" font-family="sans-serif" font-size="13" font-weight="800" text-anchor="middle" id="sc-z1-eev">240 P (Stappen)</text>',
    '',
    '',
    '  <!-- ==================== CENTER BRIDGE: SHARED PLATE CONDENSER (0x0055) ==================== -->',
    '  <rect x="640" y="545" width="120" height="270" rx="12" fill="url(#hxGrad)" stroke="var(--c-text-sec)" stroke-width="2.2"/>',
    '  <rect x="650" y="555" width="100" height="42" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-border-muted)" stroke-width="1"/>',
    '  <text x="700" y="573" fill="var(--c-text-title)" font-family="sans-serif" font-size="11" font-weight="800" text-anchor="middle">PLATENCONDENSOR</text>',
    '  <text x="700" y="588" fill="var(--c-text-muted)" font-family="sans-serif" font-size="9.5" text-anchor="middle">Koudemiddel ⇄ CV-Water</text>',
    '',
    '  <!-- Internal HX plates visual -->',
    '  <line x1="668" y1="610" x2="668" y2="740" stroke="var(--c-red)" stroke-width="3" stroke-opacity="0.7"/>',
    '  <line x1="684" y1="610" x2="684" y2="740" stroke="var(--c-orange)" stroke-width="3" stroke-opacity="0.7"/>',
    '  <line x1="700" y1="610" x2="700" y2="740" stroke="var(--c-text-sec)" stroke-width="2" stroke-dasharray="4 4"/>',
    '  <line x1="716" y1="610" x2="716" y2="740" stroke="var(--c-orange-light)" stroke-width="3" stroke-opacity="0.7"/>',
    '  <line x1="732" y1="610" x2="732" y2="740" stroke="var(--c-sky)" stroke-width="3" stroke-opacity="0.7"/>',
    '',
    '  <rect x="650" y="750" width="100" height="54" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-border-muted)" stroke-width="1"/>',
    '  <text x="700" y="767" fill="var(--c-amber-light)" font-family="sans-serif" font-size="10" font-weight="700" text-anchor="middle">Plate HX (0x0055)</text>',
    '  <text id="sc-hx-temp" x="700" y="783" fill="var(--c-text-strong)" font-family="sans-serif" font-size="13" font-weight="800" text-anchor="middle">34,8 °C</text>',
    '  <text x="700" y="797" fill="var(--c-green)" font-family="sans-serif" font-size="9.5" font-weight="600" text-anchor="middle" id="sc-hx-qth">Q_th = 6,18 kW</text>',
    '',
    '',
    '  <!-- ==================== ZONE II: HYDRONIC LOOP, DHW & 1R1C BUILDING MODEL ==================== -->',
    '  <!-- Water Supply Line from Plate Condensor (T7: 35.2°C) -> PWM Pump -> 3-Way Valve -->',
    '  <path id="sc-pipe-supply" class="schema-pipe-anim flow-active" d="M 760 595 L 985 595" fill="none" stroke="var(--c-orange)" stroke-width="4.5"/>',
    '  <polygon points="825,590 837,595 825,600" fill="var(--c-orange-arrow)" stroke="none"/>',
    '  <polygon points="945,590 957,595 945,600" fill="var(--c-orange-arrow)" stroke="none"/>',
    '',
    '  <!-- Tag T7 Water Outlet -->',
    '  <rect x="772" y="544" width="104" height="38" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-orange)" stroke-width="1.2"/>',
    '  <text x="824" y="560" fill="var(--c-orange-pale)" font-family="sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">AANVOER T7 (0x0050)</text>',
    '  <text id="sc-z2-t7" x="824" y="575" fill="var(--c-text-strong)" font-family="sans-serif" font-size="13" font-weight="800" text-anchor="middle">35,2 °C</text>',
    '',
    '  <!-- Water Pump PWM (0x0057) on Supply Line -->',
    '  <circle cx="905" cy="595" r="22" fill="var(--c-surface-inner)" stroke="var(--c-green)" stroke-width="2.5"/>',
    '  <polygon points="900,587 915,595 900,603" fill="var(--c-green-light)" stroke="none"/>',
    '  <text x="905" y="633" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="middle" id="sc-z2-pump">Pomp: 65% PWM</text>',
    '',
    '  <!-- 3-Way Valve (SWW / CV) -->',
    '  <rect x="985" y="577" width="44" height="36" rx="6" fill="#b45309" stroke="var(--c-amber-pale)" stroke-width="1.8"/>',
    '  <text x="1007" y="599" fill="var(--c-text-strong)" font-family="sans-serif" font-size="10" font-weight="800" text-anchor="middle">3-WEG</text>',
    '  <text x="1007" y="566" fill="var(--c-orange-pale)" font-family="sans-serif" font-size="10.5" font-weight="700" text-anchor="middle" id="sc-z2-valve">Stand: CV</text>',
    '',
    '  <!-- Upper Branch from 3-Way Valve -> DHW Tank (SWW, currently standby/dashed) -->',
    '  <path d="M 1007 577 L 1007 520 L 1140 520" fill="none" stroke="var(--c-orange-light)" stroke-width="2.5" stroke-dasharray="5 4" stroke-opacity="0.55"/>',
    '  <path d="M 1140 565 L 1055 565 L 1055 765" fill="none" stroke="var(--c-sky)" stroke-width="2.5" stroke-dasharray="5 4" stroke-opacity="0.45"/>',
    '',
    '  <!-- Lower Branch from 3-Way Valve -> Active Space Heating (Buffer & Building Model) -->',
    '  <path id="sc-pipe-cv" class="schema-pipe-anim flow-active" d="M 1029 595 L 1090 595 L 1090 705 L 1140 705" fill="none" stroke="var(--c-orange)" stroke-width="4.5"/>',
    '  <polygon points="1085,650 1090,662 1095,650" fill="var(--c-orange-arrow)" stroke="none"/>',
    '',
    '  <!-- Return Line from Space Heating -> Flow Sensor (0x0058) -> Plate Condensor (T6: 30.2°C) -->',
    '  <path id="sc-pipe-return" class="schema-pipe-anim flow-active" d="M 1140 765 L 760 765" fill="none" stroke="var(--c-sky)" stroke-width="4.5"/>',
    '  <polygon points="960,760 948,765 960,770" fill="var(--c-sky-pale)" stroke="none"/>',
    '  <polygon points="825,760 813,765 825,770" fill="var(--c-sky-pale)" stroke="none"/>',
    '',
    '  <!-- Tag T6 Water Inlet -->',
    '  <rect x="772" y="780" width="104" height="38" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-sky)" stroke-width="1.2"/>',
    '  <text x="824" y="796" fill="var(--c-sky-light)" font-family="sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">RETOUR T6 (0x004F)</text>',
    '  <text id="sc-z2-t6" x="824" y="811" fill="var(--c-text-strong)" font-family="sans-serif" font-size="13" font-weight="800" text-anchor="middle">30,2 °C</text>',
    '',
    '  <!-- Flow Sensor & Thermal Meter on Return Line (0x0058) -->',
    '  <rect x="888" y="742" width="110" height="46" rx="8" fill="var(--c-surface-inner)" stroke="var(--c-teal)" stroke-width="1.8"/>',
    '  <text x="943" y="761" fill="var(--c-teal)" font-family="sans-serif" font-size="10" font-weight="700" text-anchor="middle">FLOWSENSOR 0x0058</text>',
    '  <text id="sc-z2-flow" x="943" y="779" fill="var(--c-text-strong)" font-family="sans-serif" font-size="13.5" font-weight="800" text-anchor="middle">17,8 L/min</text>',
    '',
    '  <!-- Auxiliary Heat Source / Backup E-Heater & AHS Status Box (Bottom of Zone II left) -->',
    '  <rect x="772" y="855" width="340" height="135" rx="10" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1.2"/>',
    '  <text x="790" y="878" fill="var(--c-sky-sec)" font-family="sans-serif" font-size="11" font-weight="700">KLEPPEN, BIJVERWARMING (AHS) &amp; BEVEILIGING</text>',
    '  <line x1="790" y1="886" x2="1094" y2="886" stroke="var(--c-border)" stroke-width="1"/>',
    '  <text x="790" y="906" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">• Backup E-Heater / Leiding (P182):</text>',
    '  <text x="1094" y="906" fill="var(--c-green-light)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="end" id="sc-z2-eheater">Uit (0 W)</text>',
    '  <text x="790" y="926" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">• Hulpwarmtebron AHS (P139/P140):</text>',
    '  <text x="1094" y="926" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" id="sc-z2-ahs">Stand-by (&lt; -5,0 °C)</text>',
    '  <text x="790" y="946" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">• Vorstbeveiliging &amp; Sterilisatie:</text>',
    '  <text x="1094" y="946" fill="var(--c-green-light)" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" id="sc-z2-protection">Bewaking actief</text>',
    '  <text x="790" y="966" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">• Actieve storingen (0x0002–0x0009):</text>',
    '  <text x="1094" y="966" fill="var(--c-green)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="end" id="sc-z2-faults">0 storingen</text>',
    '',
    '',
    '  <!-- Component II-A (Top Right): Tapwaterboiler SWW (0x0054 & 0x0059) -->',
    '  <rect x="1128" y="470" width="292" height="150" rx="10" fill="var(--c-surface-inner)" stroke="var(--c-amber)" stroke-width="1.5"/>',
    '  <!-- Mini Cylinder Tank inside card -->',
    '  <rect x="1146" y="488" width="54" height="112" rx="14" fill="url(#dhwGrad)" stroke="var(--c-amber-pale)" stroke-width="1.8"/>',
    '  <path d="M 1153 518 H 1190 A 6 6 0 0 1 1190 530 H 1158 A 6 6 0 0 0 1158 542 H 1190 A 6 6 0 0 1 1190 554 H 1153" fill="none" stroke="var(--c-coil-stroke)" stroke-width="2"/>',
    '  <text x="1216" y="496" fill="var(--c-amber-light)" font-family="sans-serif" font-size="11.5" font-weight="700">TAPWATERBOILER (SWW)</text>',
    '  <text id="sc-dhw-temp" x="1216" y="526" fill="var(--c-text-strong)" font-family="sans-serif" font-size="24" font-weight="800">51,8 °C</text>',
    '  <text x="1316" y="524" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">(0x0054)</text>',
    '  <text id="sc-dhw-set" x="1216" y="546" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">Setpoint: <tspan fill="var(--c-amber-light)" font-weight="700">53,0 °C</tspan> · Curve: <tspan fill="var(--c-amber-light)" font-weight="700">H2</tspan></text>',
    '  <text id="sc-dhw-ret" x="1216" y="564" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Retourwater (0x0059): <tspan fill="var(--c-text-main)" font-weight="600">48,2 °C</tspan></text>',
    '  <text x="1216" y="582" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11" id="sc-dhw-circulation">SWW Circulatie (Backwater): <tspan fill="var(--c-text-label)">Uit</tspan></text>',
    '  <text x="1216" y="600" fill="var(--c-green-light)" font-family="sans-serif" font-size="10.5" font-weight="600" id="sc-dhw-status">✓ Op temperatuur (Geen vraag)</text>',
    '',
    '',
    '  <!-- Component II-B (Bottom Right): CV-Afgifte & 1R1C-Gebouwmodel + Adaptieve PI-Regelaar -->',
    '  <rect x="1128" y="645" width="292" height="345" rx="10" fill="var(--c-surface-inner)" stroke="var(--c-purple)" stroke-width="1.8"/>',
    '  <text x="1146" y="670" fill="var(--c-purple-light)" font-family="sans-serif" font-size="11.5" font-weight="700">WONING, AFGIFTE &amp; 1R1C-GEBOUWMODEL</text>',
    '  <line x1="1146" y1="678" x2="1402" y2="678" stroke="var(--c-border)" stroke-width="1"/>',
    '',
    '  <!-- Floor Heating / Emitter Box -->',
    '  <rect x="1146" y="690" width="256" height="78" rx="8" fill="var(--c-panel-alt)" stroke="var(--c-orange)" stroke-width="1.2"/>',
    '  <text x="1160" y="710" fill="var(--c-orange-pale)" font-family="sans-serif" font-size="11" font-weight="700">CV-afgifte (schematisch)</text>',
    '  <text id="sc-emit-temps" x="1160" y="730" fill="var(--c-text-main)" font-family="sans-serif" font-size="12">Aanvoer: <tspan fill="var(--c-orange)" font-weight="700">34,8 °C</tspan>   |   Retour: <tspan fill="var(--c-sky)" font-weight="700">29,9 °C</tspan></text>',
    '  <!-- Serpentine floor heating coil graphic -->',
    '  <path d="M 1160 744 H 1384 A 5 5 0 0 1 1384 754 H 1160" fill="none" stroke="var(--c-orange-light)" stroke-width="2" stroke-opacity="0.75"/>',
    '',
    '  <!-- Adaptive Control & Building Thermal Model Box -->',
    '  <rect x="1146" y="780" width="256" height="194" rx="8" fill="var(--c-nav-bg)" stroke="var(--c-border-pill)" stroke-width="1"/>',
    '  <text x="1160" y="800" fill="var(--c-sky-sec)" font-family="sans-serif" font-size="10.5" font-weight="700">ADAPTIEVE PI-REGELAAR &amp; GEBOUWMODEL</text>',
    '',
    '  <text x="1160" y="822" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Kamertemperatuur:</text>',
    '  <text x="1388" y="822" fill="var(--c-text-strong)" font-family="sans-serif" font-size="12.5" font-weight="800" text-anchor="end" id="sc-pi-room">20,6 °C (Doel 20,5°)</text>',
    '',
    '  <text x="1160" y="842" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Aanvoerdoel:</text>',
    '  <text x="1388" y="842" fill="var(--c-teal)" font-family="sans-serif" font-size="11.5" font-weight="700" text-anchor="end" id="sc-pi-offset">35,0 °C (+0,0 K)</text>',
    '',
    '  <text x="1160" y="862" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Thermische capaciteit (C):</text>',
    '  <text x="1388" y="862" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5" font-weight="700" text-anchor="end" id="sc-bm-c">14,2 kWh/K</text>',
    '',
    '  <text x="1160" y="882" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Warmteverliescoëfficiënt (UA):</text>',
    '  <text x="1388" y="882" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5" font-weight="700" text-anchor="end" id="sc-bm-ua">0,21 kW/K</text>',
    '',
    '  <text x="1160" y="902" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Thermische tijdconstante (τ):</text>',
    '  <text x="1388" y="902" fill="var(--c-purple-light)" font-family="sans-serif" font-size="11.5" font-weight="700" text-anchor="end" id="sc-bm-tau">67,4 uur</text>',
    '',
    '  <text x="1160" y="922" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Weerprognose 6u:</text>',
    '  <text x="1388" y="922" fill="var(--c-sky)" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" id="sc-bm-weather">+6,2 °C (Geen pre-heat)</text>',
    '',
    '  <!-- Model Confidence Bar -->',
    '  <text x="1160" y="946" fill="var(--c-text-label)" font-family="sans-serif" font-size="10">RLS Model-betrouwbaarheid:</text>',
    '  <rect x="1160" y="953" width="188" height="7" rx="3.5" fill="var(--c-border)" stroke="none"/>',
    '  <rect id="sc-rls-bar" x="1160" y="953" width="165" height="7" rx="3.5" fill="var(--c-purple)" stroke="none"/>',
    '  <text x="1388" y="960" fill="var(--c-purple-light)" font-family="sans-serif" font-size="10.5" font-weight="700" text-anchor="end" id="sc-rls-pct">88%</text>',
    '',
    '  <!-- Schematic Legend Bar at Bottom of Container -->',
    '  <text x="48" y="1044" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11.5" font-weight="600">Koudemiddel:</text>',
    '  <line x1="132" y1="1040" x2="150" y2="1040" stroke="var(--c-red)" stroke-width="3.5"/>',
    '  <text x="156" y="1044" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">Persgas (T5)</text>',
    '  <line x1="236" y1="1040" x2="254" y2="1040" stroke="var(--c-amber)" stroke-width="3.5"/>',
    '  <text x="260" y="1044" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">Vloeistof (T8/T9)</text>',
    '  <line x1="364" y1="1040" x2="382" y2="1040" stroke="var(--c-purple-light)" stroke-width="3" stroke-dasharray="4 2"/>',
    '  <text x="388" y="1044" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">EVI-Dampinjectie</text>',
    '  <line x1="494" y1="1040" x2="512" y2="1040" stroke="var(--c-teal)" stroke-width="3.5"/>',
    '  <text x="518" y="1044" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">2-Fase (EEV→T2)</text>',
    '  <line x1="624" y1="1040" x2="642" y2="1040" stroke="var(--c-sky)" stroke-width="3.5"/>',
    '  <text x="648" y="1044" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">Zuiggas (T4)</text>',
    '',
    '  <text x="756" y="1044" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11.5" font-weight="600">Hydronisch:</text>',
    '  <line x1="832" y1="1040" x2="850" y2="1040" stroke="var(--c-orange)" stroke-width="3.5"/>',
    '  <text x="856" y="1044" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">Aanvoer (T7)</text>',
    '  <line x1="938" y1="1040" x2="956" y2="1040" stroke="var(--c-sky)" stroke-width="3.5"/>',
    '  <text x="962" y="1044" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">Retour (T6)</text>',
    '  <line x1="1038" y1="1040" x2="1056" y2="1040" stroke="var(--c-orange-light)" stroke-width="2.5" stroke-dasharray="4 3"/>',
    '  <text x="1062" y="1044" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">SWW-Laadcircuit</text>',
    '',
    '',
    '  <!-- ==================== LAAG 3: ONDERBALK IN 3 KOLOMMEN (24U GRAFIEK + STOOKLIJN-KRUISDRAAD + POLL-DIAGNOSTIEK) ==================== -->',
    '  <text x="28" y="1104" fill="var(--c-sky-sec)" font-family="sans-serif" font-size="12" font-weight="700" letter-spacing="1">HISTORIE, STOOKLIJN-WERKPUNT &amp; MODBUS POLL-DIAGNOSTIEK</text>',
    '  <line x1="28" y1="1112" x2="1452" y2="1112" stroke="var(--c-border)" stroke-width="1"/>',
    '',
    '  <!-- Kolom 1 (Links, x=28..668): 24u Temperatuur & Compressor Grafiek -->',
    '  <rect x="28" y="1124" width="640" height="420" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <text x="48" y="1150" fill="var(--c-text-h1)" font-family="sans-serif" font-size="14" font-weight="700">Gemeten historie — Temperaturen (°C) &amp; Compressor (Hz)</text>',
    '  <text x="648" y="1150" fill="var(--c-text-label)" font-family="sans-serif" font-size="11" text-anchor="end">Gemeten historie sinds appstart</text>',
    '',
    '  <!-- Chart Axes (x=72..638, y=1180..1410) -->',
    '  <text x="62" y="1184" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end">60°</text>',
    '  <line x1="70" y1="1180" x2="642" y2="1180" stroke="var(--c-badge-slate)" stroke-width="1"/>',
    '',
    '  <text x="62" y="1242" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end">40°</text>',
    '  <line x1="70" y1="1238" x2="642" y2="1238" stroke="var(--c-badge-slate)" stroke-width="1"/>',
    '',
    '  <text x="62" y="1300" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end">20°</text>',
    '  <line x1="70" y1="1296" x2="642" y2="1296" stroke="var(--c-badge-slate)" stroke-width="1"/>',
    '',
    '  <text x="62" y="1358" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end">0°</text>',
    '  <line x1="70" y1="1354" x2="642" y2="1354" stroke="var(--c-border)" stroke-width="1"/>',
    '',
    '  <!-- Compressor Hz Shaded Area at bottom of chart -->',
    '  <path id="sc-chart-comp-area" d="M 70 1354 L 70 1310 L 160 1304 L 250 1318 L 340 1285 L 410 1312 L 520 1308 L 642 1306 L 642 1354 Z" fill="url(#compArea)" stroke="none"/>',
    '',
    '  <!-- Curves -->',
    '  <!-- SWW Tank 51.8°C -->',
    '  <path id="sc-chart-dhw" d="M 70 1206 C 150 1212, 240 1218, 320 1196 C 400 1192, 510 1202, 642 1204" fill="none" stroke="var(--c-amber-light)" stroke-width="2.2"/>',
    '  <!-- T7 Outlet 35.2°C -->',
    '  <path id="sc-chart-t7" d="M 70 1252 C 150 1246, 240 1250, 320 1255 C 400 1248, 510 1249, 642 1252" fill="none" stroke="var(--c-orange)" stroke-width="2.2"/>',
    '  <!-- T6 Inlet 30.2°C -->',
    '  <path id="sc-chart-t6" d="M 70 1267 C 150 1261, 240 1265, 320 1270 C 400 1263, 510 1264, 642 1267" fill="none" stroke="var(--c-sky)" stroke-width="2.2"/>',
    '  <!-- Room 20.6°C -->',
    '  <path id="sc-chart-room" d="M 70 1294 C 220 1293, 410 1295, 642 1294" fill="none" stroke="var(--c-purple)" stroke-width="2.2"/>',
    '  <!-- T1 Ambient 7.4°C -->',
    '  <path id="sc-chart-t1" d="M 70 1332 C 160 1342, 260 1344, 380 1326 C 480 1318, 560 1328, 642 1332" fill="none" stroke="var(--c-teal)" stroke-width="2"/>',
    '',
    '  <text x="70" y="1372" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" id="sc-time-start">—</text>',
    '  <text x="356" y="1372" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="middle" id="sc-time-middle">—</text>',
    '  <text x="642" y="1372" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end" id="sc-time-end">—</text>',
    '',
    '  <!-- Compact Legend strip under chart -->',
    '  <rect x="48" y="1390" width="600" height="134" rx="8" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <circle cx="68" cy="1414" r="4.5" fill="var(--c-orange)" stroke="none"/>',
    '  <text id="sc-leg-t7" x="80" y="1418" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5">Aanvoer T7 (0x0050): <tspan font-weight="700">35,2 °C</tspan></text>',
    '',
    '  <circle cx="288" cy="1414" r="4.5" fill="var(--c-sky)" stroke="none"/>',
    '  <text id="sc-leg-t6" x="300" y="1418" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5">Retour T6 (0x004F): <tspan font-weight="700">30,2 °C</tspan></text>',
    '',
    '  <circle cx="488" cy="1414" r="4.5" fill="var(--c-amber-light)" stroke="none"/>',
    '  <text id="sc-leg-dhw" x="500" y="1418" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5">SWW (0x0054): <tspan font-weight="700">51,8 °C</tspan></text>',
    '',
    '  <circle cx="68" cy="1444" r="4.5" fill="var(--c-purple)" stroke="none"/>',
    '  <text id="sc-leg-room" x="80" y="1448" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5">Woonkamer (PI): <tspan font-weight="700">20,6 °C</tspan></text>',
    '',
    '  <circle cx="288" cy="1444" r="4.5" fill="var(--c-teal)" stroke="none"/>',
    '  <text id="sc-leg-t1" x="300" y="1448" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5">Buitentemp T1: <tspan font-weight="700">7,4 °C</tspan></text>',
    '',
    '  <rect x="483" y="1439" width="10" height="10" rx="2" fill="var(--c-sky)" fill-opacity="0.4" stroke="var(--c-sky)" stroke-width="1"/>',
    '  <text id="sc-leg-comp" x="500" y="1448" fill="var(--c-text-main)" font-family="sans-serif" font-size="11.5">Comp: <tspan font-weight="700">48 Hz</tspan></text>',
    '',
    '  <line x1="64" y1="1468" x2="632" y2="1468" stroke="var(--c-badge-slate)" stroke-width="1"/>',
    '  <text id="sc-leg-sub1" x="64" y="1490" fill="var(--c-text-label)" font-family="sans-serif" font-size="11">Persgas T5: <tspan fill="var(--c-text-main)" font-weight="600">68,4 °C</tspan> · Zuiggas T4: <tspan fill="var(--c-text-main)" font-weight="600">5,1 °C</tspan> · Economizer T8/T9: <tspan fill="var(--c-text-main)" font-weight="600">19,5 / 14,2 °C</tspan> · Condensor: <tspan fill="var(--c-text-main)" font-weight="600">34,8 °C</tspan></text>',
    '  <text id="sc-leg-sub2" x="64" y="1510" fill="var(--c-text-label)" font-family="sans-serif" font-size="11">EEV (0x0042): <tspan fill="var(--c-sky)" font-weight="600">240 P</tspan> · EVI (0x0043): <tspan fill="var(--c-purple-light)" font-weight="600">80 P</tspan> · Fan (0x0041): <tspan fill="var(--c-text-main)" font-weight="600">540 RPM</tspan> · Waterpomp (0x0057): <tspan fill="var(--c-teal)" font-weight="600">65 % PWM</tspan></text>',
    '',
    '',
    '  <!-- Kolom 2 (Midden, x=684..1068): Stooklijn Visualisatie & Werkpunt (heating_curve_line.html stijl) -->',
    '  <rect x="684" y="1124" width="384" height="420" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <text x="704" y="1150" fill="var(--c-text-h1)" font-family="sans-serif" font-size="14" font-weight="700">Stooklijn &amp; werkpunt</text>',
    '  <text x="704" y="1168" fill="var(--c-text-label)" font-family="sans-serif" font-size="11">Curve alleen bij bekende parameters</text>',
    '',
    '  <!-- Heating Curve Grid (x=730..1044, y=1195..1395; X: -15°C to +20°C, Y: 55°C to 20°C) -->',
    '  <text x="722" y="1200" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end">55°</text>',
    '  <line x1="730" y1="1196" x2="1044" y2="1196" stroke="var(--c-badge-slate)" stroke-width="1"/>',
    '',
    '  <text x="722" y="1266" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end">40°</text>',
    '  <line x1="730" y1="1262" x2="1044" y2="1262" stroke="var(--c-badge-slate)" stroke-width="1"/>',
    '',
    '  <text x="722" y="1332" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end">30°</text>',
    '  <line x1="730" y1="1328" x2="1044" y2="1328" stroke="var(--c-badge-slate)" stroke-width="1"/>',
    '',
    '  <text x="722" y="1398" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end">20°</text>',
    '  <line x1="730" y1="1394" x2="1044" y2="1394" stroke="var(--c-border)" stroke-width="1"/>',
    '',
    '  <!-- Reference High Curve H4 (dimmed) -->',
    '  <polyline points="730,1196 775,1196 998,1328 1044,1328" fill="none" stroke="var(--c-border-muted)" stroke-width="1.5" stroke-dasharray="4 4"/>',
    '  <text x="785" y="1212" fill="var(--c-text-dim)" font-family="sans-serif" font-size="9.5" id="sc-hc-reference">Voorbeeldcurve</text>',
    '',
    '  <!-- Active Low Curve L4 -->',
    '  <polyline points="730,1244 775,1244 998,1352 1044,1352" fill="none" stroke="var(--c-sky)" stroke-width="3"/>',
    '',
    '  <!-- Crosshair on Current Operating Point (T1 = 7.4°C -> x=931, Target = 35.0°C -> y=1302) -->',
    '  <line id="sc-hc-vline" x1="931" y1="1196" x2="931" y2="1394" stroke="var(--c-orange)" stroke-width="1.2" stroke-dasharray="3 3"/>',
    '  <line id="sc-hc-hline" x1="730" y1="1302" x2="1044" y2="1302" stroke="var(--c-orange)" stroke-width="1.2" stroke-dasharray="3 3"/>',
    '  <circle id="sc-hc-dot" cx="931" cy="1302" r="7" fill="var(--c-orange)" stroke="var(--c-surface-inner)" stroke-width="2"/>',
    '  <circle id="sc-hc-ring" cx="931" cy="1302" r="12" fill="none" stroke="var(--c-orange)" stroke-width="1.5" stroke-opacity="0.6"/>',
    '',
    '  <!-- X-axis labels (-15°C to +20°C) -->',
    '  <text x="730" y="1412" fill="var(--c-text-label)" font-family="sans-serif" font-size="10">-15 °C</text>',
    '  <text x="820" y="1412" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="middle">-5 °C</text>',
    '  <text x="910" y="1412" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="middle">+5 °C</text>',
    '  <text x="1044" y="1412" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" text-anchor="end">+20 °C</text>',
    '',
    '  <!-- Stooklijn Details Box -->',
    '  <rect x="704" y="1428" width="344" height="96" rx="8" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <text x="720" y="1450" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11" id="sc-hc-wp-label">Huidig werkpunt (T1 = 7,4 °C):</text>',
    '  <text x="1032" y="1450" fill="var(--c-orange)" font-family="sans-serif" font-size="12" font-weight="700" text-anchor="end" id="sc-hc-wp-val">Doel 35,0 °C (Actueel 35,2°)</text>',
    '  <text x="720" y="1472" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Basisstooklijn (0x0313 / DPS 13):</text>',
    '  <text x="1032" y="1472" fill="var(--c-sky)" font-family="sans-serif" font-size="11.5" font-weight="700" text-anchor="end" id="sc-hc-curve-val">Curve L4 (Lage temp)</text>',
    '  <text x="720" y="1494" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Native DIY-registers (L27–L29):</text>',
    '  <text x="1032" y="1494" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" id="sc-hc-diy-val">0x0810–0x0812 beschikbaar</text>',
    '  <text x="720" y="1514" fill="var(--c-text-label)" font-family="sans-serif" font-size="10" id="sc-hc-formula">—</text>',
    '',
    '',
    '  <!-- Kolom 3 (Rechts, x=1084..1452): Modbus Poll-Groepen & Kalibratie Diagnostiek -->',
    '  <rect x="1084" y="1124" width="368" height="420" rx="10" fill="url(#cardSurface)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <text x="1104" y="1150" fill="var(--c-text-h1)" font-family="sans-serif" font-size="14" font-weight="700">Modbus Poll-Groepen &amp; Kalibratie</text>',
    '  <text x="1104" y="1168" fill="var(--c-text-label)" font-family="sans-serif" font-size="11">ADR-042 Verbindingskwaliteit &amp; ADR-050 Schaling</text>',
    '',
    '  <!-- Poll Group Badges & Status Rows -->',
    '  <rect x="1104" y="1184" width="328" height="34" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="1112" y="1192" width="76" height="18" rx="4" fill="var(--c-tint-green-1)" stroke="var(--c-green)" stroke-width="1"/>',
    '  <text x="1150" y="1205" fill="var(--c-green-light)" font-family="sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">SUPERFAST</text>',
    '  <text x="1198" y="1205" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">0x0000, 0x0040, 0x004F–5C</text>',
    '  <text x="1420" y="1205" fill="var(--c-green-light)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="end" id="sc-poll-sf">5 s · OK</text>',
    '',
    '  <rect x="1104" y="1224" width="328" height="34" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="1112" y="1232" width="76" height="18" rx="4" fill="var(--c-tint-blue-1)" stroke="var(--c-sky)" stroke-width="1"/>',
    '  <text x="1150" y="1245" fill="var(--c-sky)" font-family="sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">FAST</text>',
    '  <text x="1198" y="1245" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">Sensoren 0x0040–0x005D</text>',
    '  <text x="1420" y="1245" fill="var(--c-sky)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="end" id="sc-poll-fast">10 s · OK</text>',
    '',
    '  <rect x="1104" y="1264" width="328" height="34" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="1112" y="1272" width="76" height="18" rx="4" fill="var(--c-tint-indigo)" stroke="var(--c-indigo-light)" stroke-width="1"/>',
    '  <text x="1150" y="1285" fill="var(--c-indigo-pale)" font-family="sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">MEDIUM</text>',
    '  <text x="1198" y="1285" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">Faults, Relais &amp; Control 0x0300</text>',
    '  <text x="1420" y="1285" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" id="sc-poll-med">30 s · OK</text>',
    '',
    '  <rect x="1104" y="1304" width="328" height="34" rx="6" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <rect x="1112" y="1312" width="76" height="18" rx="4" fill="var(--c-tint-purple)" stroke="var(--c-purple-light)" stroke-width="1"/>',
    '  <text x="1150" y="1325" fill="var(--c-purple-pale)" font-family="sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">SLOW / P&amp;L</text>',
    '  <text x="1198" y="1325" fill="var(--c-text-main)" font-family="sans-serif" font-size="11">P-bank 0x0100 &amp; L-bank 0x0810</text>',
    '  <text x="1420" y="1325" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" id="sc-poll-slow">120 s · OK</text>',
    '',
    '  <!-- Calibration & Hardware Info Card -->',
    '  <rect x="1104" y="1350" width="328" height="174" rx="8" fill="var(--c-surface-inner)" stroke="var(--c-border)" stroke-width="1"/>',
    '  <text x="1120" y="1372" fill="var(--c-sky-sec)" font-family="sans-serif" font-size="10.5" font-weight="700"> ACTIEVE HARDWARE- &amp; SENSORKALIBRATIE</text>',
    '',
    '  <text x="1120" y="1394" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Koelmiddel &amp; Temp-schaal (P119):</text>',
    '  <text x="1416" y="1394" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="end" id="sc-cal-scale">R32 (×1) / R290 (×0,1)</text>',
    '',
    '  <text x="1120" y="1414" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">AC-stroomkalibratie (0x0045):</text>',
    '  <text x="1416" y="1414" fill="var(--c-teal)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="end" id="sc-cal-curr">marnie-curve actief</text>',
    '',
    '  <text x="1120" y="1434" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">AC-spanningscorrectie (0x0044):</text>',
    '  <text x="1416" y="1434" fill="var(--c-text-main)" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" id="sc-cal-volt">Factor ×0,99 (231 V)</text>',
    '',
    '  <text x="1120" y="1454" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Protocol &amp; Coil-support (0x0363):</text>',
    '  <text x="1416" y="1454" fill="var(--c-green-light)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="end" id="sc-cal-proto">v1.34 (FC05 Coils ja)</text>',
    '',
    '  <text x="1120" y="1474" fill="var(--c-text-muted)" font-family="sans-serif" font-size="11">Fast-poll fouten (ADR-042):</text>',
    '  <text x="1416" y="1474" fill="var(--c-green)" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="end" id="sc-cal-err">0 (Poll: 1s geleden)</text>',
    '',
    '  <text x="1120" y="1508" fill="var(--c-sky-sec)" font-family="sans-serif" font-size="11" font-weight="600">Open Register- &amp; Change Log Inspector (/expert) →</text>',
    '</svg>',
  ].join('\n');

  const TUYA_TEMPLATE_SWAPS = [
    ['COMPRESSOR (0x0040 / 0x0027)', 'COMPRESSOR (DPS 20 / DPS 27)'],
    ['>Doel: 48 Hz</text>', '>Status: Aan (DPS 27)</text>'],
    ['>IPM: 44,2 °C · 5,8 A</text>', '>Stroom: 6,2 A (DPS 102)</text>'],
    ['DEBIET &amp; WATERPOMP (0x0058)', 'WATERDEBIET &amp; ΔT (DPS 39)'],
    ['x="682" y="202"', 'x="662" y="202"'],
    ['>PWM: 65 %</text>', '>Watermodus (DPS 10)</text>'],
    ['x="682" y="218"', 'x="662" y="218"'],
    ['>ΔT: 5,0 K</text>', '>ΔT: 5,0 K (22–21)</text>'],
    ['WATER AANVOER (T7) / RETOUR (T6)', 'AANVOER (DPS 22) / RETOUR (DPS 21)'],
    ['BUITEN (T1) &amp; FAN (0x0041)', 'BUITEN (DPS 26) &amp; FAN (DPS 40)'],
    ['>Fan: 540 RPM</text>', '>Fan: 36 Hz (DPS 40)</text>'],
    ['>Coil T2: 3,8 °C</text>', '>Coiler: 3,8 °C (DPS 23)</text>'],
    ['2. Elektrisch (0x005C)', '2. Elektrisch (DPS 104)'],
    ['231 V · 6,2 A · Totaal 1.184 kWh', '231 V (DPS 103) · Dag: 14,2 kWh (DPS 18)'],
    ['Externe kWh-meter (1.420 W)</tspan> + Modbus 0x0045 (marnie-gekalibreerd)', 'DPS 104 (÷10 = 1.420 W)</tspan> · Totaalteller DPS 105: 1.184 kWh'],
    ['width="320" height="26"', 'width="360" height="26"'],
    ['ZONE I · EVI KOUDEMIDDELCYCLUS (R32 / R290)', 'ZONE I · EVI KOUDEMIDDELCYCLUS (TUYA DPS 16–108)'],
    ['>ZUIGGAS T4</text>', '>ZUIGGAS (DPS 41)</text>'],
    ['>5,1 °C (0x004D)</text>', '>5,1 °C (coiler_f)</text>'],
    ['>PERSGAS T5 (HEETGAS)</text>', '>PERSGAS (DPS 24)</text>'],
    ['>68,4 °C (0x004E)</text>', '>68,4 °C (venting)</text>'],
    ['>Doel: 48 Hz · 5,8 A</text>', '>6,2 A (DPS 102)</text>'],
    ['>IPM: 44,2 °C (0x0047)</text>', '>Status: Actief (DPS 27)</text>'],
    ['>DRUKVERZADIGING</text>', '>DPS 35 / DPS 36</text>'],
    ['>540 RPM (36 Hz)</text>', '>Fan: 36 Hz (DPS 40)</text>'],
    ['Buitenlucht T1:', 'Buiten (DPS 26):'],
    ['Outer Coil T2:', 'Coiler (DPS 23):'],
    ['Inner Coil T3: <tspan font-weight="700">4,2 °C', 'Incoiler (DPS 37): <tspan font-weight="700">34,8 °C'],
    ['✓ Ontdooiing: Inactief (0x/24u)', '✓ Ontdooiing (DPS 33): Inactief'],
    ['Inlaat T8 (0x0051):', 'Evlin Inlaat (DPS 107):'],
    ['Uitlaat T9 (0x0052):', 'Eviout Uitlaat (DPS 108):'],
    ['EVI-Expansieklep (0x0043): 80 P', 'EVI-Expansieklep (DPS 25): 80 P'],
    ['HOOFD-EEV (0x0042)', 'HOOFD-EEV (DPS 16)'],
    ['Plate HX (0x0055)', 'Condensor (DPS 37)'],
    ['AANVOER T7 (0x0050)', 'AANVOER (DPS 22)'],
    ['Pomp: 65% PWM', 'Circulatie: Actief'],
    ['RETOUR T6 (0x004F)', 'RETOUR (DPS 21)'],
    ['FLOWSENSOR 0x0058', 'WATERFLOW DPS 39'],
    ['KLEPPEN, BIJVERWARMING (AHS) &amp; BEVEILIGING', 'TUYA BEDRIJFSMODI, CIRCULATIE &amp; BEVEILIGING'],
    ['• Backup E-Heater / Leiding (P182):', '• Schakelaar &amp; Modus (DPS 1 / DPS 2):'],
    ['>Uit (0 W)</text>', '>Aan · Verwarmen</text>'],
    ['• Hulpwarmtebron AHS (P139/P140):', '• Werk- &amp; Watermodus (DPS 5 / 10):'],
    ['>Stand-by (&lt; -5,0 °C)</text>', '>Normaal · Watertemp</text>'],
    ['• Vorstbeveiliging &amp; Sterilisatie:', '• Retourwater / Backwater (DPS 31):'],
    ['>Bewaking actief</text>', '>Uit (Geen vraag)</text>'],
    ['• Actieve storingen (0x0002–0x0009):', '• Fouttoestand &amp; Alarm (DPS 15):'],
    ['>(0x0054)</text>', '>(DPS 38)</text>'],
    ['Retourwater (0x0059):', 'Dagverbruik (DPS 18):'],
    ['48,2 °C', '14,20 kWh'],
    ['HISTORIE, STOOKLIJN-WERKPUNT &amp; MODBUS POLL-DIAGNOSTIEK', 'HISTORIE, STOOKLIJN-WERKPUNT &amp; TUYAPI DPS-DIAGNOSTIEK'],
    ['SUPERFAST / Insights (5 s)', 'Gemeten historie sinds appstart'],
    ['Aanvoer T7 (0x0050):', 'Aanvoer (DPS 22):'],
    ['Retour T6 (0x004F):', 'Retour (DPS 21):'],
    ['SWW (0x0054):', 'SWW (DPS 38):'],
    ['Buitentemp T1:', 'Buiten (DPS 26):'],
    ['Actieve Stooklijn (L4 &amp; DIY L27–L29)', 'Actieve Stooklijn (DPS 13 &amp; App-Stooklijn)'],
    ['Basisstooklijn (0x0313 / DPS 13):', 'Tuya Verwarmingscurve (DPS 13):'],
    ['Native DIY-registers (L27–L29):', 'Lineaire App-Stooklijn (helling/snijpunt):'],
    ['0x0810–0x0812 beschikbaar', 'y = -0,55·x + 39,0 °C'],
    ['Modbus Poll-Groepen &amp; Kalibratie', 'TuyAPI Verbinding &amp; DPS-Diagnostiek'],
    ['ADR-042 Verbindingskwaliteit &amp; ADR-050 Schaling', 'Multi-Layer Heartbeat (L0–L4) &amp; DPS Schaling'],
    ['>SUPERFAST</text>', '>TUYAPI L0</text>'],
    ['>0x0000, 0x0040, 0x004F–5C</text>', '>Socket &amp; Heartbeat (35 s)</text>'],
    ['>5 s · OK</text>', '>Verbonden</text>'],
    ['>FAST</text>', '>DPS STREAM</text>'],
    ['>Sensoren 0x0040–0x005D</text>', '>Push-events &amp; Versheid</text>'],
    ['>10 s · OK</text>', '>28 DPS · &lt;60s</text>'],
    ['>MEDIUM</text>', '>ENERGIE</text>'],
    ['>Faults, Relais &amp; Control 0x0300</text>', '>DPS 18 / 102 / 103 / 104 / 105</text>'],
    ['>30 s · OK</text>', '>÷10 / ÷100</text>'],
    ['>SLOW / P&amp;L</text>', '>CURVES</text>'],
    ['>P-bank 0x0100 &amp; L-bank 0x0810</text>', '>DPS 11 (SWW) &amp; DPS 13 (CV)</text>'],
    ['>120 s · OK</text>', '>H2 / L4 actief</text>'],
    ['ACTIEVE HARDWARE- &amp; SENSORKALIBRATIE', 'TUYA HARDWARE- &amp; DPS-SCHALING'],
    ['Koelmiddel &amp; Temp-schaal (P119):', 'MCU Mainboard Firmware (DPS 14):'],
    ['AC-stroomkalibratie (0x0045):', 'Energiemodule Type (DPS 106):'],
    ['AC-spanningscorrectie (0x0044):', 'Vermogensschaling (DPS 104 / 105):'],
    ['Protocol &amp; Coil-support (0x0363):', 'Spanning &amp; Stroom (DPS 103 / 102):'],
    ['Fast-poll fouten (ADR-042):', 'Zombie-detecties (24u, Layer 4):'],
    ['Open Register- &amp; Change Log Inspector (/expert) →', 'Open DPS- &amp; Wijzigingen-Inspector (/expert) →'],
  ];

  // Aurora III has its own sensor names, FC04 addresses and hydraulic units.
  const AURORA3_TEMPLATE_SWAPS = [
    ['Adlar Castra Aurora II', 'Adlar Castra Aurora III'],
    ['Koppeling EVI-koudemiddelcyclus (T1–T9)', 'Aurora III-koudemiddelcyclus (TH / TP / T3 / T4)'],
    ['COMPRESSOR (0x0040 / 0x0027)', 'COMPRESSOR (3-79 / 3-78)'],
    ['DEBIET &amp; WATERPOMP (0x0058)', 'DEBIET (3-64) &amp; POMP (3-62)'],
    ['x="682" y="202"', 'x="700" y="202"'],
    ['x="682" y="218"', 'x="700" y="218"'],
    ['WATER AANVOER (T7) / RETOUR (T6)', 'AANVOER TA (3-43) / RETOUR TE1 (3-42)'],
    ['BUITEN (T1) &amp; FAN (0x0041)', 'BUITEN T4 (3-50) &amp; FAN (3-72)'],
    ['2. Elektrisch (0x005C)', '2. Elektrisch (3-74 × 3-75)'],
    ['I. EVI KOUDEMIDDELKRINGLOOP', 'I. KOUDEMIDDELKRINGLOOP'],
    ['ZONE I · EVI KOUDEMIDDELCYCLUS (R32 / R290)', 'ZONE I · AURORA III KOUDEMIDDELCYCLUS'],
    ['ZUIGGAS T4', 'ZUIGGAS TH (3-53)'],
    ['PERSGAS T5 (HEETGAS)', 'PERSGAS TP (3-52)'],
    ['DRUKVERZADIGING', 'DRUK (3-86 / 3-87)'],
    ['x="255" y="574" width="92"', 'x="255" y="574" width="180"'],
    ['x="301" y="591"', 'x="345" y="591"'],
    ['x="301" y="605"', 'x="345" y="605"'],
    ['EVI ECONOMIZER (SUBCOOLER)', 'KOUDEMIDDEL &amp; OMKEERKLEP'],
    ['Tussendruk dampinjectie → Compressor', 'Verwarmen / koelen / ontdooien'],
    ['HOOFD-EEV (0x0042)', 'HOOFD-EEV (3-70)'],
    ['Plate HX (0x0055)', 'HX-sensor'],
    ['AANVOER T7 (0x0050)', 'AANVOER TA (3-43)'],
    ['RETOUR T6 (0x004F)', 'RETOUR TE1 (3-42)'],
    ['FLOWSENSOR 0x0058', 'DEBIET 3-64'],
    ['• Backup E-Heater / Leiding (P182):', '• Backup-aanvraag (4-2103):'],
    ['• Hulpwarmtebron AHS (P139/P140):', '• Hoofdpomp (3-80):'],
    ['• Vorstbeveiliging &amp; Sterilisatie:', '• Vorst / Desinfectie (3-38):'],
    ['• Actieve storingen (0x0002–0x0009):', '• Storingen / beveiligingen (3-90–101):'],
    ['>(0x0054)</text>', '>(3-46)</text>'],
    ['Persgas (T5)', 'Persgas (TP)'],
    ['Vloeistof (T8/T9)', 'Vloeistof'],
    ['EVI-Dampinjectie', 'Omkeerklep'],
    ['2-Fase (EEV→T2)', '2-Fase (EEV→T3)'],
    ['Zuiggas (T4)', 'Zuiggas (TH)'],
    ['Aanvoer (T7)', 'Aanvoer (TA)'],
    ['Retour (T6)', 'Retour (TE1)'],
    ['SWW-Laadcircuit (Stand-by)', 'SWW-Laadcircuit'],
    ['Vloerverwarming &amp; Parallelbuffer', 'CV-afgifte &amp; Buffer TW (3-45)'],
    ['Stooklijn L4 + PI-correctie:', 'Aanvoerdoel + PI-correctie:'],
    ['RLS Model-betrouwbaarheid:', 'RLS Model-betrouwbaarheid:'],
    ['24-Uurs Verloop — Temperaturen (°C) &amp; Compressor (Hz)', 'Temperatuur- &amp; compressorhistorie (max. 24u)'],
    ['SUPERFAST / Insights (5 s)', 'Historie sinds appstart'],
    ['-24u (20:15)', 'Begin historie'],
    ['-12u (08:15)', 'Midden'],
    ['Nu (20:15)', 'Laatste meting'],
    ['Actieve Stooklijn (L4 &amp; DIY L27–L29)', 'Aanvoerwerkpunt Aurora III'],
    ['Weersafhankelijke aanvoerregeling + Adaptieve PI-offset', 'Werkpunt uit buitenlucht en aanvoerdoel'],
    ['Basisstooklijn (0x0313 / DPS 13):', 'Curvedoel (3-67):'],
    ['Native DIY-registers (L27–L29):', 'Zone 1-doel (4-2107):'],
    ['Formule: T_set = -k · (T_ambient + 15) + b + ΔT_PI', '3-67: schaal nog op hardware te controleren'],
    ['Modbus Poll-Groepen &amp; Kalibratie', 'Aurora III-registergroepen'],
    ['ADR-042 Verbindingskwaliteit &amp; ADR-050 Schaling', '3-N = input (FC04) · 4-N = holding (FC03)'],
    ['0x0000, 0x0040, 0x004F–5C', '3-38–39, 42–43, 64, 79'],
    ['Sensoren 0x0040–0x005D', '3-40–56, 62–64, 70–81'],
    ['Faults, Relais &amp; Control 0x0300', '3-9, 60–61, 86–103 · 4-2100–2114'],
    ['SLOW / P&amp;L', 'SLOW / GRENZEN'],
    ['P-bank 0x0100 &amp; L-bank 0x0810', '3-10–31, 66–69'],
    ['ACTIEVE HARDWARE- &amp; SENSORKALIBRATIE', 'AURORA III-SCHALING &amp; DIAGNOSTIEK'],
    ['Koelmiddel &amp; Temp-schaal (P119):', 'Temperatuurregisters:'],
    ['AC-stroomkalibratie (0x0045):', 'AC-stroom (3-75):'],
    ['AC-spanningscorrectie (0x0044):', 'AC-spanning (3-74):'],
    ['Protocol &amp; Coil-support (0x0363):', 'Modbus-functiecodes:'],
    ['Fast-poll fouten (ADR-042):', 'Fast-poll fouten:'],
  ];

  function getAurora3Template() {
    let out = SVG_TEMPLATE;
    AURORA3_TEMPLATE_SWAPS.forEach(([oldStr, newStr]) => {
      out = out.split(oldStr).join(newStr);
    });
    // No EVI bypass or example curves: neither is established by the III snapshots.
    out = out.replace(/<!-- 4\. EVI Bypass Branch[\s\S]*?(?=<!-- 5\. Two-Phase)/, '');
    out = out.replace(/<polyline\b[^>]*\/>/g, '');
    out = out.replace(/<text\b[^>]*>Referentie H4<\/text>/, '');
    // Live starts with unknown values; demo mode supplies a separate III fixture.
    out = out.replace(/(<text\b[^>]*\bid="sc-[^"]+"[^>]*>)[\s\S]*?<\/text>/g, '$1—</text>');
    return out;
  }

  const getTemplateForDriver = (driverType, demo = false) => {
    let out = driverType === 'aurora3' ? getAurora3Template() : SVG_TEMPLATE;
    if (driverType === 'tuya') {
      TUYA_TEMPLATE_SWAPS.forEach(([a, b]) => {
        out = out.replace(a, b);
      });
    }
    if (demo) return out;
    out = out.replace(/(<text\b[^>]*\bid="sc-[^"]+"[^>]*>)[\s\S]*?<\/text>/g, '$1—</text>');
    out = out.replace(/<polyline\b[^>]*\/>/g, '');
    out = out.replace(/(<path\b[^>]*\bid="sc-chart-[^"]+"[^>]*\bd=")[^"]*/g, '$1');
    out = out.replace(/(<(?:circle|line)\b[^>]*\bid="sc-hc-(?:dot|ring|vline|hline)"[^>]*)(\/>)/g, '$1 visibility="hidden"$2');
    return out.replace('</svg>', '<text id="sc-cop-diagnostic" x="64" y="1090" fill="var(--c-amber-light)" font-family="sans-serif" font-size="11"></text><path id="sc-hc-curve" d="" fill="none" stroke="var(--c-sky)" stroke-width="2"/></svg>');
  };

  let currentMode = 'live';
  let lastLiveVm = null;
  let mountedContainer = null;
  let mountedDriver = 'aurora2';

  const fmt = (val, digits = 1, fallback = '—') => {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return fallback;
    return Number(val).toLocaleString('nl-NL', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  const setText = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };

  const setAttr = (id, attr, val) => {
    const node = document.getElementById(id);
    if (node) node.setAttribute(attr, String(val));
  };

  const capMapFromList = (capList) => {
    const map = {};
    if (Array.isArray(capList)) {
      capList.forEach((item) => {
        if (item && item.id !== undefined) map[item.id] = item.value;
      });
    }
    return map;
  };

  const pickCap = (caps, baseId, driver) => {
    let suffix = '';
    if (driver.endsWith('3')) suffix = `_${driver}`;
    if (driver === 'aurora2') suffix = '_modbus';
    if (suffix && caps[baseId + suffix] !== undefined && caps[baseId + suffix] !== null) {
      return caps[baseId + suffix];
    }
    if (caps[baseId] !== undefined && caps[baseId] !== null) {
      return caps[baseId];
    }
    return null;
  };

  const knownState = (value, yes, no) => {
    if (value === null || value === undefined) return '—';
    return value ? yes : no;
  };

  function selectPower(driver, snap, caps, proc) {
    if (Object.prototype.hasOwnProperty.call(proc, 'electricalPowerKw')) {
      return { kw: proc.electricalPowerKw, source: proc.electricalPowerKw === null ? '—' : knownState(proc.powerSource === 'external', 'Externe meter', 'Interne Modbus-meting') };
    }
    const external = pickCap(caps, 'adlar_external_power', driver);
    if (typeof external === 'number' && Number.isFinite(external) && external >= 0) {
      return { kw: external / 1000, source: 'Externe meter' };
    }
    return { kw: snap?.power?.inputPowerKw ?? snap?.power?.derivedPowerKw ?? null, source: snap?.power ? 'Interne Modbus-meting' : '—' };
  }

  function modbusFlowLpm(snap, isAurora3) {
    const sensor = snap?.sensors?.waterFlow;
    if (!isAurora3) return snap?.cop?.flowLpm ?? sensor?.value ?? null;
    // COP carries the effective flow, including an external flow meter when configured.
    if (snap?.cop?.flowLpm !== undefined && snap.cop.flowLpm !== null) return snap.cop.flowLpm;
    if (sensor?.value === undefined || sensor.value === null) return null;
    return sensor.value * (sensor.unit === 'L/min' ? 1 : 1000 / 60);
  }

  function normalizeModbus(driver, snap, capList) {
    const caps = capMapFromList(capList);
    const s = snap?.sensors || {};
    const isA3 = driver.endsWith('3');
    const proc = snap?.liveOperation?.process || {};
    const power = selectPower(driver, snap, caps, proc);

    const t1 = (isA3 ? s.ambientT4?.value : s.ambientT1?.value) ?? snap?.cop?.ambientTempC ?? null;
    const t2 = (isA3 ? s.outerCoilT3?.value : s.outerCoilT2?.value) ?? null;
    const t3 = isA3 ? null : (s.innerCoilT3?.value ?? null);
    const t4 = (isA3 ? s.suctionTH?.value : s.suctionT4?.value) ?? null;
    const t5 = (isA3 ? s.dischargeTP?.value : s.exhaustT5?.value) ?? null;
    const t6 = (isA3 ? s.retourTE1?.value : s.inletT6?.value) ?? null;
    const t7 = (isA3 ? s.aanvoerTA?.value : s.outletT7?.value) ?? null;
    const t8 = isA3 ? null : (s.econInT8?.value ?? null);
    const t9 = isA3 ? null : (s.econOutT9?.value ?? null);
    const dhwTemp = s.dhwTankTemp?.value ?? pickCap(caps, 'measure_temperature.dhw', driver);
    const dhwRet = isA3 ? null : (s.dhwReturnTemp?.value ?? null);
    const plateHx = isA3 ? null : (s.plateHxTemp?.value ?? null);

    const compHz = s.compRunningFreq?.value
      ?? pickCap(caps, isA3 ? 'measure_frequency.compressor_freq' : 'measure_frequency.compressor', driver)
      ?? null;
    const compTargetHz = s.compTargetFreq?.value ?? (isA3 ? null : compHz);
    const compAmps = s.compPhaseI?.value ?? s.acCurrent?.value ?? snap?.power?.inputCurrentA ?? null;
    const ipmTemp = isA3 ? null : (s.ipmTemp?.value ?? null);
    const fanRpm = s.fanSpeed?.value ?? null;
    const eevStep = s.eevStep?.value ?? null;
    const eviStep = s.eviStep?.value ?? null;
    const pumpPwm = s.pumpPwm?.value ?? null;
    const flowLpm = Object.prototype.hasOwnProperty.call(proc, 'flowLpm') ? proc.flowLpm : (pickCap(caps, 'adlar_external_flow', driver) ?? modbusFlowLpm(snap, isA3));

    const hdSat = isA3 ? null : (s.hpSatTemp?.value ?? null);
    const ldSat = isA3 ? null : (s.lpSatTemp?.value ?? null);

    const elecKw = power.kw;
    const thKw = proc.thermalPowerKw ?? snap?.cop?.thermalPowerKw ?? null;
    const cop = proc.capabilityCop ?? pickCap(caps, 'adlar_cop', driver);
    const scop = pickCap(caps, 'adlar_scop', driver);
    const cop24 = pickCap(caps, 'adlar_cop_daily', driver);

    const roomTemp = pickCap(caps, 'measure_temperature.indoor', driver) ?? (isA3 ? s.roomTemp?.value ?? null : null);
    const roomTarget = pickCap(caps, 'target_temperature.indoor', driver) ?? null;
    const heatSetpoint = snap?.control?.heatingSetpointC ?? pickCap(caps, 'target_temperature', driver);
    const dhwSetpoint = snap?.control?.dhwSetpointC ?? pickCap(caps, 'target_temperature.dhw', driver);

    const bmC = pickCap(caps, 'adlar_building_c', driver);
    const bmUA = pickCap(caps, 'adlar_building_ua', driver);
    const bmTau = pickCap(caps, 'adlar_building_tau', driver);
    const bmConf = pickCap(caps, 'adlar_building_model_confidence', driver);
    const forecast6h = pickCap(caps, 'measure_temperature.weather_forecast_6h', driver);
    const priceNow = pickCap(caps, 'adlar_energy_price_current', driver);

    const faults = snap?.status?.activeFaults || [];
    const running = snap?.status?.compressorOn ?? (compHz === null ? null : compHz > 0);
    const defrosting = snap?.status?.defrosting ?? null;
    const dhwActive = snap?.status?.dhwActive ?? (snap?.control?.modeName ? snap.control.modeName === 'Hot Water' : null);
    const curveNum = snap?.control?.heatingCurve ?? null;
    const dhwCurveNum = snap?.control?.hotWaterCurve ?? null;
    let curveLabel = '—';
    if (snap?.diy?.active) curveLabel = 'DIY L27–L29';
    else if (curveNum !== null) curveLabel = curveNum === 0 ? 'Uit' : `L${curveNum}`;

    return {
      driver,
      title: document.body?.dataset?.schemaTitle
        || `Adlar Aurora ${isA3 ? 'III' : 'I/II'} (Modbus) — Processchema`,
      modeName: snap?.control?.modeName || '—',
      curveLabel,
      dhwCurveLabel: dhwCurveNum ? `H${dhwCurveNum}` : 'SWW',
      running,
      defrosting,
      dhwActive,
      t1,
      t2,
      t3,
      t4,
      t5,
      t6,
      t7,
      t8,
      t9,
      dhwTemp,
      dhwRet,
      plateHx,
      compHz,
      compTargetHz,
      compAmps,
      ipmTemp,
      fanRpm,
      eevStep,
      eviStep,
      pumpPwm,
      flowLpm,
      hdSat,
      ldSat,
      elecKw,
      thKw,
      cop,
      scop,
      cop24,
      voltageV: snap?.power?.inputVoltageV ?? snap?.power?.acVoltageV ?? s.acVoltage?.value ?? null,
      currentA: snap?.power?.inputCurrentA ?? snap?.power?.acCurrentA ?? s.acCurrent?.value ?? null,
      totalElecKwh: snap?.power?.totalEnergyKwh ?? pickCap(caps, 'meter_power.electric_total', driver) ?? null,
      powerSource: power.source,
      copMethod: pickCap(caps, 'adlar_cop_method', driver),
      copDiagnostic: snap?.liveOperation?.copDiagnostic ?? null,
      appCurve: snap?.diy?.active ? { slope: -snap.diy.slopeK, intercept: snap.diy.interceptB - 15 * snap.diy.slopeK } : null,
      powerDetail: snap?.power?.powerSource ?? null,
      roomTemp,
      roomTarget,
      heatSetpoint,
      dhwSetpoint,
      bmC,
      bmUA,
      bmTau,
      bmConf,
      forecast6h,
      priceNow,
      faultCount: snap?.status?.activeFaults ? faults.length : null,
      tempScale: snap?.temperatureScale || (isA3 ? 'x10' : null),
      protocolVer: snap?.version?.protocolVersionFormatted || (isA3 ? 'FC04 / FC03' : '—'),
      coilsAvailable: snap?.control?.coilsAvailable ?? null,
      fastFailures: snap?.diagnostics?.consecutiveFastPollFailures ?? null,
      history: Array.isArray(snap?.history) ? snap.history : [],
      ...(isA3 ? {
        highPressure: s.highPressure?.value ?? null,
        lowPressure: s.lowPressure?.value ?? null,
        bufferTemp: s.bufferTankTemp?.value ?? null,
        totalOutlet: s.totalOutlet?.value ?? null,
        mainPumpState: s.mainPumpState?.value ?? null,
        fourWayValveState: s.fourWayValveState?.value ?? null,
        curveHeatingSetpoint: snap?.control?.curveHeatingSetpointC ?? null,
        backupHeaterForced: snap?.control?.backupHeaterForced ?? null,
        antifreeze: snap?.status?.antifreeze ?? null,
        sterilization: snap?.status?.sterilization ?? null,
      } : {}),
    };
  }

  function normalizeTuya(snap, capList, hcPayload) {
    const caps = capMapFromList(capList);
    const temps = snap?.temperatures || {};
    const proc = snap?.process || {};
    const stat = snap?.status || {};

    const t1 = temps.ambientC ?? caps['measure_temperature.around_temp'] ?? null;
    const t2 = caps['measure_temperature.coiler_temp'] ?? null;
    const t3 = caps['measure_temperature.bottom_temp_f'] ?? null;
    const t4 = caps['measure_temperature.coiler_temp_f'] ?? null;
    const t5 = caps['measure_temperature.venting_temp'] ?? null;
    const t6 = temps.inletC ?? caps['measure_temperature.temp_top'] ?? null;
    const t7 = temps.outletC ?? caps['measure_temperature.temp_bottom'] ?? null;
    const t8 = caps['measure_temperature.evlin'] ?? null;
    const t9 = caps['measure_temperature.eviout'] ?? null;
    const dhwTemp = temps.dhwC ?? caps['measure_temperature.around_temp_f'] ?? null;

    const compHz = proc.compressorHz ?? caps['measure_frequency.compressor_strength'] ?? null;
    const fanRpm = caps['measure_frequency.fan_motor_frequency'] ?? null;
    const eevStep = caps.adlar_measure_pulse_steps_temp_current ?? null;
    const eviStep = caps.adlar_measure_pulse_steps_effluent_temp ?? null;
    const flowLpm = proc.flowLpm ?? caps.measure_water ?? null;

    const elecKw = proc.electricalPowerKw ?? (typeof caps.measure_power === 'number' ? caps.measure_power / 1000 : null);
    const thKw = proc.thermalPowerKw ?? null;
    const cop = proc.capabilityCop ?? caps.adlar_cop ?? null;
    const scop = caps.adlar_scop ?? null;
    const cop24 = caps.adlar_cop_daily ?? null;

    const roomTemp = caps['measure_temperature.indoor'] ?? null;
    const roomTarget = caps['target_temperature.indoor'] ?? null;
    const heatSetpoint = temps.setpointC ?? caps.target_temperature ?? null;
    const dhwSetpoint = caps.adlar_hotwater ?? null;

    const bmC = caps.adlar_building_c ?? null;
    const bmUA = caps.adlar_building_ua ?? null;
    const bmTau = caps.adlar_building_tau ?? null;
    const bmConf = caps.adlar_building_model_confidence ?? null;
    const forecast6h = caps['measure_temperature.weather_forecast_6h'] ?? null;
    const priceNow = caps.adlar_energy_price_current ?? null;

    const running = stat.compressorOn ?? (compHz === null ? null : compHz > 0);
    const defrosting = stat.defrosting ?? null;
    const faultVal = stat.faultActive;
    const faultCount = faultVal === null || faultVal === undefined ? null : Number(Number(faultVal) > 0);

    return {
      driver: 'tuya',
      title: document.body?.dataset?.page === 'processchema' ? document.title : 'Adlar Aurora I/II (Tuya) — Processchema',
      modeName: String(caps.adlar_enum_mode || '—'),
      curveLabel: String(hcPayload?.heating || caps.adlar_enum_work_mode || 'Stooklijn'),
      dhwCurveLabel: String(hcPayload?.hotWater || caps.adlar_enum_water_mode || 'SWW'),
      running,
      defrosting,
      dhwActive: caps.adlar_enum_mode ? /water|dhw|sww/i.test(caps.adlar_enum_mode) : null,
      t1,
      t2,
      t3,
      t4,
      t5,
      t6,
      t7,
      t8,
      t9,
      dhwTemp,
      dhwRet: caps['meter_power.power_consumption'] ?? null,
      plateHx: t3,
      compHz,
      compTargetHz: compHz,
      compAmps: caps['measure_current.cur_current'] ?? null,
      ipmTemp: null,
      fanRpm,
      eevStep,
      eviStep,
      pumpPwm: null,
      flowLpm,
      hdSat: caps['measure_temperature.temp_current_f'] ?? null,
      ldSat: caps['measure_temperature.top_temp_f'] ?? null,
      mcuFirmware: caps.adlar_firmware_mcu ?? null,
      powerModule: caps.adlar_enum_volume_set ?? null,
      workMode: caps.adlar_enum_work_mode ?? null,
      waterMode: caps.adlar_enum_water_mode ?? null,
      appCurve: hcPayload?.appCurve ?? null,
      elecKw,
      thKw,
      cop,
      scop,
      cop24,
      voltageV: caps['measure_voltage.voltage_current'] ?? null,
      currentA: caps['measure_current.cur_current'] ?? null,
      totalElecKwh: caps['meter_power.electric_total'] ?? null,
      powerSource: ({ external: 'Externe meter', capability: 'Tuya vermogensmeting' })[proc.powerSource] ?? '—',
      copMethod: caps.adlar_cop_method ?? null,
      copDiagnostic: snap?.copDiagnostic ?? null,
      powerDetail: null,
      tuyaOn: caps.onoff ?? null,
      backwater: caps.adlar_state_backwater ?? null,
      roomTemp,
      roomTarget,
      heatSetpoint,
      dhwSetpoint,
      bmC,
      bmUA,
      bmTau,
      bmConf,
      forecast6h,
      priceNow,
      faultCount,
      tempScale: 'Tuya DPS',
      protocolVer: 'TuyAPI Local',
      coilsAvailable: false,
      fastFailures: 0,
      history: Array.isArray(snap?.history) ? snap.history : [],
    };
  }

  function mount(container, driverType = 'aurora2') {
    mountedContainer = container;
    mountedDriver = driverType;
    if (!container.querySelector('.schema-svg')) {
      container.innerHTML = getTemplateForDriver(driverType);
      update(driverType === 'tuya' ? normalizeTuya({}, [], {}) : normalizeModbus(driverType, {}, []));
    }
  }

  function updateHistoryChart(history) {
    ['dhw', 't7', 't6', 'room', 't1', 'comp-area'].forEach((key) => setAttr(`sc-chart-${key}`, 'd', ''));
    ['start', 'middle', 'end'].forEach((key) => setText(`sc-time-${key}`, '—'));
    if (!Array.isArray(history) || history.length < 2) return;
    const points = history.filter((p) => Number.isFinite(p.ts)).sort((a, b) => a.ts - b.ts);
    if (points.length < 2) return;
    const start = points[0].ts;
    const end = points[points.length - 1].ts;
    if (end <= start) return;
    const xAt = (p) => Math.round(70 + ((p.ts - start) / (end - start)) * 572);
    const time = (ts) => new Date(ts).toLocaleString('nl-NL', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    setText('sc-time-start', time(start));
    setText('sc-time-middle', time((start + end) / 2));
    setText('sc-time-end', time(end));
    const buildPath = (key, yAt) => {
      let penDown = false;
      return points.map((p) => {
        if (typeof p[key] !== 'number' || !Number.isFinite(p[key])) {
          penDown = false; return '';
        }
        const command = penDown ? 'L' : 'M';
        penDown = true;
        return `${command} ${xAt(p)} ${yAt(p[key])}`;
      }).filter(Boolean).join(' ');
    };
    ['dhw', 't7', 't6', 'room', 't1'].forEach((key) => {
      setAttr(`sc-chart-${key}`, 'd', buildPath(key, (v) => Math.round(1354 - Math.max(-15, Math.min(65, v)) * 2.9)));
    });
    // A line avoids filling across gaps where compressor readings are unknown.
    setAttr('sc-chart-comp-area', 'fill', 'none');
    setAttr('sc-chart-comp-area', 'stroke', 'var(--c-sky)');
    setAttr('sc-chart-comp-area', 'stroke-width', '1.5');
    setAttr('sc-chart-comp-area', 'd', buildPath('hz', (v) => Math.round(1354 - (Math.max(0, Math.min(90, v)) / 90) * 110)));
  }

  function update(vm) {
    if (!vm) return;
    const isTuya = vm.driver === 'tuya';
    setText('sc-title', vm.title);
    setText('sc-chip-mode', isTuya ? `DPS 2: ${vm.modeName}` : `Modus: ${vm.modeName}`);
    setText('sc-chip-curve', isTuya ? `DPS 13: ${vm.curveLabel}` : `Stooklijn: ${vm.curveLabel}`);
    let eviChip = knownState(vm.eviStep === null ? null : vm.eviStep > 0, 'Open', 'Gesloten');
    if (vm.eviStep && vm.eviStep > 0) eviChip = `${fmt(vm.eviStep, 0)} P`;
    setText('sc-chip-evi', isTuya ? `DPS 5: ${vm.workMode || eviChip}` : `EVI-Injectie: ${eviChip}`);

    setText('sc-cop-label', `COP · ${vm.copMethod ?? 'Homey / —'}`);
    const diagnostic = vm.copDiagnostic;
    const rejected = diagnostic && ['outlier', 'insufficient_data'].includes(diagnostic.quality);
    const displayCOP = rejected ? null : vm.cop;
    setText('sc-kpi-cop', fmt(displayCOP, 2));
    setText('sc-cop-raw', rejected && diagnostic.rawCOP > 0 ? `Berekend: ${fmt(diagnostic.rawCOP, 2)} · controle nodig` : '');
    setText('sc-cop-diagnostic', rejected ? `COP-controle: ${diagnostic.reason ?? 'Geen geldige meting'} · Berekend: ${fmt(diagnostic.rawCOP, 2)} · ${fmt(diagnostic.electricalPowerW, 0)} W · ${fmt(diagnostic.flowLpm, 1)} L/min · ΔT ${fmt(diagnostic.deltaTC, 1)} K` : '');
    let powerLabel = '2. Elektrisch';
    if (vm.elecKw !== null) powerLabel += vm.powerSource === 'Externe meter' ? ' (extern)' : ' (intern)';
    setText('sc-power-label', powerLabel);
    setText('sc-kpi-scop', `SCOP: ${fmt(vm.scop, 2)}`);
    setText('sc-kpi-cop24', `24u-gem: ${fmt(vm.cop24, 2)}`);

    setText('sc-kpi-comp-hz', `${fmt(vm.compHz, 0)} Hz`);
    setText('sc-kpi-comp-target', isTuya ? `Status: ${vm.running ? 'Aan' : 'Uit'} (DPS 27)` : `Doel: ${fmt(vm.compTargetHz, 0)} Hz`);
    setText('sc-kpi-comp-ipm', isTuya ? `Stroom: ${fmt(vm.compAmps, 1)} A (DPS 102)` : `IPM: ${fmt(vm.ipmTemp, 1)} °C · ${fmt(vm.compAmps, 1)} A`);
    const compBarW = Math.max(4, Math.min(210, Math.round(((Number(vm.compHz) || 0) / 85) * 210)));
    setAttr('sc-kpi-comp-bar', 'width', compBarW);

    const dt = (vm.t7 !== null && vm.t6 !== null) ? (vm.t7 - vm.t6) : null;
    setText('sc-kpi-flow', `${fmt(vm.flowLpm, 1)} L/min`);
    let pwmLabel = 'Debiet actief';
    if (isTuya) pwmLabel = 'Watermodus (DPS 10)';
    if (vm.pumpPwm !== null) pwmLabel = `PWM: ${fmt(vm.pumpPwm, 0)} %`;
    setText('sc-kpi-pwm', pwmLabel);
    setText('sc-kpi-dt', isTuya ? `ΔT: ${fmt(dt, 1)} K (22–21)` : `ΔT: ${fmt(dt, 1)} K`);
    const flowBarW = Math.max(4, Math.min(210, Math.round(((Number(vm.flowLpm) || 0) / 30) * 210)));
    setAttr('sc-kpi-flow-bar', 'width', flowBarW);

    setText('sc-kpi-t7t6', `${fmt(vm.t7, 1)}° / ${fmt(vm.t6, 1)}°`);

    setText('sc-kpi-t1', `${fmt(vm.t1, 1)} °C`);
    setText('sc-kpi-fan', isTuya ? `Fan: ${fmt(vm.fanRpm, 0)} Hz (DPS 40)` : `Fan: ${fmt(vm.fanRpm, 0)} RPM`);
    setText('sc-kpi-t2', isTuya ? `Coiler: ${fmt(vm.t2, 1)} °C (DPS 23)` : `Coil T2: ${fmt(vm.t2, 1)} °C`);

    setText('sc-kpi-room', `${fmt(vm.roomTemp, 1)} °C`);
    setText('sc-kpi-room-target', `Doel: ${fmt(vm.roomTarget, 1)} °C`);
    setText('sc-kpi-tau', `τ = ${fmt(vm.bmTau, 1)} u (${fmt(vm.bmConf, 0)}%)`);

    const { elecKw, thKw } = vm;
    const envKw = thKw !== null && elecKw !== null ? Math.max(0, thKw - elecKw) : null;
    const totalOut = thKw > 0.05 ? thKw : 1;
    const envPct = thKw > 0.05 ? Math.round((envKw / totalOut) * 100) : 0;
    const elecPct = thKw > 0.05 ? (100 - envPct) : 0;
    setText('sc-sankey-cop', displayCOP === null ? '—' : `×${fmt(displayCOP, 2)}`);
    setText('sc-sankey-env', `${fmt(envKw, 2)} kW${envKw !== null ? ` (${envPct}%)` : ''}`);
    setText('sc-sankey-elec', `${fmt(elecKw, 2)} kW${elecKw !== null && thKw > 0 ? ` (${elecPct}%)` : ''}`);
    setText('sc-sankey-elec-sub', `Intern: ${fmt(vm.voltageV, 0)} V · ${fmt(vm.currentA, 1)} A · ${fmt(vm.totalElecKwh, 0)} kWh`);
    setText('sc-sankey-th', `${fmt(thKw, 2)} kW_th`);
    setText('sc-sankey-th-sub', `${fmt(vm.flowLpm, 1)} L/min × ΔT ${fmt(dt, 1)} K`);
    setText('sc-sankey-th-total', '');
    const price = typeof vm.priceNow === 'number' && Number.isFinite(vm.priceNow) ? vm.priceNow : null;
    const hourlyCost = price !== null && elecKw !== null ? price * elecKw : null;
    setText('sc-sankey-footer', `Bron: ${vm.powerSource} (${fmt(elecKw === null ? null : elecKw * 1000, 0)} W) · Tarief: € ${fmt(price, 2)}/kWh · Kosten nu: € ${fmt(hourlyCost, 2)}/uur`);
    setText('sc-sankey-price', price !== null && displayCOP > 0 ? `€ ${fmt(price, 2)}/kWh_el → € ${fmt(price / displayCOP, 3)}/kWh_th` : 'Warmtetarief: —');

    setText('sc-z1-t4', `${fmt(vm.t4, 1)} °C`);
    setText('sc-z1-t5', `${fmt(vm.t5, 1)} °C`);
    setText('sc-z1-comp-hz', `${fmt(vm.compHz, 0)} Hz`);
    setText('sc-z1-comp-sub', isTuya ? `${fmt(vm.compAmps, 1)} A (DPS 102)` : `Doel: ${fmt(vm.compTargetHz, 0)} Hz · ${fmt(vm.compAmps, 1)} A`);
    setText('sc-z1-ipm', isTuya ? `Status: ${vm.running ? 'Actief' : 'Uit'} (DPS 27)` : `IPM: ${fmt(vm.ipmTemp, 1)} °C`);
    setText('sc-z1-sat', `HD: ${fmt(vm.hdSat, 1)}° · LD: ${fmt(vm.ldSat, 1)}°`);
    setText('sc-z1-fan', isTuya ? `Fan: ${fmt(vm.fanRpm, 0)} Hz (DPS 40)` : `${fmt(vm.fanRpm, 0)} RPM`);
    setText('sc-z1-t1', isTuya ? `Buiten (DPS 26): ${fmt(vm.t1, 1)} °C` : `Buitenlucht T1: ${fmt(vm.t1, 1)} °C`);
    setText('sc-z1-t2', isTuya ? `Coiler (DPS 23): ${fmt(vm.t2, 1)} °C` : `Outer Coil T2: ${fmt(vm.t2, 1)} °C`);
    setText('sc-z1-t3', isTuya ? `Incoiler (DPS 37): ${fmt(vm.t3, 1)} °C` : `Inner Coil T3: ${fmt(vm.t3, 1)} °C`);
    setText('sc-z1-defrost', `Ontdooiing: ${knownState(vm.defrosting, 'Actief', 'Inactief')}`);
    setText('sc-z1-t8', isTuya ? `Evlin Inlaat (DPS 107): ${fmt(vm.t8, 1)} °C` : `Inlaat T8: ${fmt(vm.t8, 1)} °C`);
    setText('sc-z1-t9', isTuya ? `Eviout Uitlaat (DPS 108): ${fmt(vm.t9, 1)} °C` : `Uitlaat T9: ${fmt(vm.t9, 1)} °C`);
    setText('sc-z1-evi', isTuya ? `EVI-Expansieklep (DPS 25): ${fmt(vm.eviStep, 0)} P` : `EVI-Expansieklep: ${fmt(vm.eviStep, 0)} P`);
    setText('sc-z1-eev', `${fmt(vm.eevStep, 0)} P (Stappen)`);

    setText('sc-hx-temp', `${fmt(vm.plateHx, 1)} °C`);
    setText('sc-hx-qth', `Q_th = ${fmt(thKw, 2)} kW`);

    setText('sc-z2-t7', `${fmt(vm.t7, 1)} °C`);
    setText('sc-z2-pump', vm.pumpPwm !== null ? `Pomp: ${fmt(vm.pumpPwm, 0)}% PWM` : `Debiet: ${fmt(vm.flowLpm, 1)} L/m`);
    setText('sc-z2-valve', `Bedrijf: ${knownState(vm.dhwActive, 'SWW', 'CV')}`);
    setText('sc-z2-t6', `${fmt(vm.t6, 1)} °C`);
    setText('sc-z2-flow', `${fmt(vm.flowLpm, 1)} L/min`);
    setText('sc-z2-faults', `${fmt(vm.faultCount, 0)} storingen`);

    setText('sc-dhw-temp', `${fmt(vm.dhwTemp, 1)} °C`);
    setText('sc-dhw-set', `Setpoint: ${fmt(vm.dhwSetpoint, 1)} °C · Curve: ${vm.dhwCurveLabel}`);
    setText('sc-dhw-ret', isTuya ? `Dagverbruik (DPS 18): ${fmt(vm.dhwRet, 2)} kWh` : `Retourwater: ${fmt(vm.dhwRet, 1)} °C`);
    setText('sc-dhw-status', knownState(vm.dhwActive, 'Tapwaterbedrijf actief', 'Geen tapwaterbedrijf'));

    setText('sc-emit-temps', `Aanvoer: ${fmt(vm.t7, 1)} °C   |   Retour: ${fmt(vm.t6, 1)} °C`);
    setText('sc-pi-room', `${fmt(vm.roomTemp, 1)} °C (Doel ${fmt(vm.roomTarget, 1)}°)`);
    setText('sc-pi-offset', `Doel: ${fmt(vm.heatSetpoint, 1)} °C`);
    setText('sc-bm-c', `${fmt(vm.bmC, 1)} kWh/K`);
    setText('sc-bm-ua', `${fmt(vm.bmUA, 2)} kW/K`);
    setText('sc-bm-tau', `${fmt(vm.bmTau, 1)} uur`);
    setText('sc-bm-weather', vm.forecast6h !== null ? `${fmt(vm.forecast6h, 1)} °C (6u verwachting)` : 'Geen forecast');
    const rlsW = Math.max(0, Math.min(188, Math.round(((Number(vm.bmConf) || 0) / 100) * 188)));
    setAttr('sc-rls-bar', 'width', rlsW);
    setText('sc-rls-pct', `${fmt(vm.bmConf, 0)}%`);

    const refrigActive = Boolean(vm.running || (Number(vm.compHz) || 0) > 0);
    const hydroActive = Boolean(vm.running || vm.mainPumpState === 1 || (Number(vm.flowLpm) || 0) > 1.5);
    ['sc-pipe-suction', 'sc-pipe-discharge', 'sc-pipe-liquid', 'sc-pipe-twophase'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('flow-active', refrigActive);
    });
    ['sc-pipe-supply', 'sc-pipe-cv', 'sc-pipe-return'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('flow-active', hydroActive);
    });

    setText('sc-leg-t7', isTuya ? `Aanvoer (DPS 22): ${fmt(vm.t7, 1)} °C` : `Aanvoer T7: ${fmt(vm.t7, 1)} °C`);
    setText('sc-leg-t6', isTuya ? `Retour (DPS 21): ${fmt(vm.t6, 1)} °C` : `Retour T6: ${fmt(vm.t6, 1)} °C`);
    setText('sc-leg-dhw', isTuya ? `SWW (DPS 38): ${fmt(vm.dhwTemp, 1)} °C` : `SWW: ${fmt(vm.dhwTemp, 1)} °C`);
    setText('sc-leg-room', `Woonkamer: ${fmt(vm.roomTemp, 1)} °C`);
    setText('sc-leg-t1', isTuya ? `Buiten (DPS 26): ${fmt(vm.t1, 1)} °C` : `Buitentemp T1: ${fmt(vm.t1, 1)} °C`);
    setText('sc-leg-comp', `Comp: ${fmt(vm.compHz, 0)} Hz`);
    setText(
      'sc-leg-sub1',
      isTuya
        ? `Persgas (DPS 24): ${fmt(vm.t5, 1)} °C · Zuiggas (DPS 41): ${fmt(vm.t4, 1)} °C · Econ (DPS 107/108): ${fmt(vm.t8, 1)} / ${fmt(vm.t9, 1)} °C · Condensor (DPS 37): ${fmt(vm.plateHx, 1)} °C`
        : `Persgas T5: ${fmt(vm.t5, 1)} °C · Zuiggas T4: ${fmt(vm.t4, 1)} °C · Economizer T8/T9: ${fmt(vm.t8, 1)} / ${fmt(vm.t9, 1)} °C · Condensor: ${fmt(vm.plateHx, 1)} °C`,
    );
    setText(
      'sc-leg-sub2',
      isTuya
        ? `EEV (DPS 16): ${fmt(vm.eevStep, 0)} P · EVI (DPS 25): ${fmt(vm.eviStep, 0)} P · Fan (DPS 40): ${fmt(vm.fanRpm, 0)} Hz · Debiet (DPS 39): ${fmt(vm.flowLpm, 1)} L/min`
        : `EEV: ${fmt(vm.eevStep, 0)} P · EVI: ${fmt(vm.eviStep, 0)} P · Fan: ${fmt(vm.fanRpm, 0)} RPM · Waterpomp: ${vm.pumpPwm !== null ? `${fmt(vm.pumpPwm, 0)} % PWM` : `${fmt(vm.flowLpm, 1)} L/m`}`,
    );
    if (vm.driver === 'aurora3') {
      // Clear illustrative paths and stale series before drawing actual history.
      ['dhw', 't7', 't6', 'room', 't1', 'comp-area'].forEach((key) => setAttr(`sc-chart-${key}`, 'd', ''));
    }
    updateHistoryChart(vm.history);

    if (vm.t1 !== null && (vm.heatSetpoint !== null || vm.t7 !== null)) {
      const amb = Math.max(-15, Math.min(20, Number(vm.t1)));
      const target = Math.max(20, Math.min(55, Number(vm.heatSetpoint ?? vm.t7)));
      const cx = Math.round(730 + ((amb + 15) / 35) * (1044 - 730));
      const cy = Math.round(1196 + ((55 - target) / 35) * (1394 - 1196));
      setAttr('sc-hc-vline', 'x1', cx);
      setAttr('sc-hc-vline', 'x2', cx);
      setAttr('sc-hc-hline', 'y1', cy);
      setAttr('sc-hc-hline', 'y2', cy);
      setAttr('sc-hc-dot', 'cx', cx);
      setAttr('sc-hc-dot', 'cy', cy);
      setAttr('sc-hc-ring', 'cx', cx);
      setAttr('sc-hc-ring', 'cy', cy);
    }
    setText('sc-hc-wp-label', `Huidig werkpunt (T1 = ${fmt(vm.t1, 1)} °C):`);
    setText('sc-hc-wp-val', `Doel ${fmt(vm.heatSetpoint, 1)} °C (Actueel ${fmt(vm.t7, 1)}°)`);
    setText('sc-hc-curve-val', `${vm.curveLabel}`);
    if (isTuya && vm.appCurve) {
      setText('sc-hc-diy-val', `y = ${fmt(vm.appCurve.slope, 2)}·x + ${fmt(vm.appCurve.intercept, 1)} °C`);
    }

    if (isTuya) {
      setText('sc-cal-scale', vm.mcuFirmware ? `${vm.mcuFirmware}` : 'Tuya MCU');
      setText('sc-cal-curr', vm.powerModule ? `${vm.powerModule}` : 'Intern');
      setText('sc-cal-volt', 'W (÷10) · kWh (÷100)');
      setText('sc-cal-proto', `${fmt(vm.voltageV, 0)} V · ${fmt(vm.currentA, 1)} A`);
      setText('sc-cal-err', `${fmt(vm.faultCount, 0)} storingen`);
    } else {
      setText('sc-cal-scale', vm.tempScale ? `Schaal: ${vm.tempScale}` : '—');
      setText('sc-cal-volt', `Spanning: ${fmt(vm.voltageV, 0)} V`);
      setText('sc-cal-proto', `${vm.protocolVer} (${knownState(vm.coilsAvailable, 'Coils ja', '—')})`);
      setText('sc-cal-err', `${vm.fastFailures} fouten`);
    }
    ['sf', 'fast', 'med', 'slow'].forEach((key) => setText(`sc-poll-${key}`, '—'));
    setText('sc-hc-reference', '');
    setText('sc-hc-formula', '');
    setText('sc-dhw-circulation', isTuya ? `Backwater (DPS 31): ${knownState(vm.backwater, 'Actief', 'Uit')}` : 'Circulatie: —');
    setText('sc-z2-eheater', isTuya ? `${knownState(vm.tuyaOn, 'Aan', 'Uit')} · ${vm.modeName}` : '—');
    setText('sc-z2-ahs', isTuya ? `${vm.workMode ?? '—'} / ${vm.waterMode ?? '—'}` : '—');
    setText('sc-z2-protection', '—');
    setText('sc-cal-err', `${fmt(vm.fastFailures, 0)} fouten`);
    if (isTuya) setText('sc-cal-err', '—');
    else setText('sc-cal-curr', vm.powerDetail === 'ac-derived' ? 'Actief (intern)' : 'Interne curve');
    setText('sc-hc-diy-val', vm.appCurve ? `y = ${fmt(vm.appCurve.slope, 2)}·x + ${fmt(vm.appCurve.intercept, 1)} °C` : '—');
    let curvePath = '';
    if (vm.appCurve && Number.isFinite(vm.appCurve.slope) && Number.isFinite(vm.appCurve.intercept)) {
      curvePath = [-15, -5, 5, 20].map((ambient, index) => {
        const target = Math.max(20, Math.min(55, vm.appCurve.slope * ambient + vm.appCurve.intercept));
        return `${index ? 'L' : 'M'} ${Math.round(730 + ((ambient + 15) / 35) * 314)} ${Math.round(1394 - ((target - 20) / 35) * 198)}`;
      }).join(' ');
      setText('sc-hc-formula', 'Curve uit ingestelde parameters');
    }
    setAttr('sc-hc-curve', 'd', curvePath);
    const hasWorkpoint = vm.t1 !== null && vm.heatSetpoint !== null;
    ['vline', 'hline', 'dot', 'ring'].forEach((key) => setAttr(`sc-hc-${key}`, 'visibility', hasWorkpoint ? 'visible' : 'hidden'));
    if (vm.driver === 'aurora3') updateAurora3(vm);
  }

  function updateAurora3(vm) {
    const onOff = (value) => {
      if (value === true || value === 1) return 'Aan';
      if (value === false || value === 0) return 'Uit';
      return '—';
    };
    let valve = '—';
    if (vm.fourWayValveState === 0) valve = 'Verwarmen';
    if (vm.fourWayValveState === 1) valve = vm.defrosting ? 'Ontdooien' : 'Koelen';
    setText('sc-chip-evi', `4-weg: ${valve}`);
    setText('sc-chip-curve', 'Zone 1');
    setText('sc-kpi-comp-ipm', `Stroom: ${fmt(vm.compAmps, 1)} A`);
    setAttr('sc-kpi-flow', 'font-size', 24);
    setText('sc-kpi-t2', `Coil T3: ${fmt(vm.t2, 1)} °C`);
    setText('sc-z1-ipm', '');
    setText('sc-z1-sat', `HD ${fmt(vm.highPressure, 0)} · LD ${fmt(vm.lowPressure, 0)} kPa`);
    setText('sc-z1-t1', `Buiten T4: ${fmt(vm.t1, 1)} °C`);
    setText('sc-z1-t2', `Buitenwisselaar T3: ${fmt(vm.t2, 1)} °C`);
    setText('sc-z1-t3', '');
    setText('sc-z1-t8', `HD (3-86): ${fmt(vm.highPressure, 0)} kPa`);
    setText('sc-z1-t9', `LD (3-87): ${fmt(vm.lowPressure, 0)} kPa`);
    setText('sc-z1-evi', `4-wegklep (3-81): ${valve}`);
    setText('sc-hx-temp', '—');
    setText('sc-z2-pump', `Pomp: ${onOff(vm.mainPumpState)} · ${fmt(vm.pumpPwm, 0)}% PWM`);
    setText('sc-z2-valve', `Bedrijf: ${knownState(vm.dhwActive, 'SWW', 'CV')}`);
    setText('sc-z2-eheater', onOff(vm.backupHeaterForced));
    setText('sc-z2-ahs', onOff(vm.mainPumpState));
    setText('sc-z2-protection', `${onOff(vm.antifreeze)} / ${onOff(vm.sterilization)}`);
    setText('sc-dhw-set', `Setpoint: ${fmt(vm.dhwSetpoint, 1)} °C`);
    setText('sc-dhw-ret', `Buffer TW (3-45): ${fmt(vm.bufferTemp, 1)} °C`);
    setText('sc-dhw-circulation', `Totale aanvoer TC (3-41): ${fmt(vm.totalOutlet, 1)} °C`);
    setText('sc-dhw-status', knownState(vm.dhwActive, 'Tapwater-lading actief (3-9)', 'Geen tapwaterbedrijf (3-9)'));
    setText('sc-leg-t7', `Aanvoer TA (3-43): ${fmt(vm.t7, 1)} °C`);
    setText('sc-leg-t6', `Retour TE1 (3-42): ${fmt(vm.t6, 1)} °C`);
    setText('sc-leg-dhw', `SWW (3-46): ${fmt(vm.dhwTemp, 1)} °C`);
    setText('sc-leg-t1', `Buiten T4 (3-50): ${fmt(vm.t1, 1)} °C`);
    setText('sc-leg-sub1', `Persgas TP (3-52): ${fmt(vm.t5, 1)} °C · Zuiggas TH (3-53): ${fmt(vm.t4, 1)} °C · HD / LD: ${fmt(vm.highPressure, 0)} / ${fmt(vm.lowPressure, 0)} kPa`);
    setText('sc-leg-sub2', `EEV (3-70): ${fmt(vm.eevStep, 0)} P · Fan (3-72): ${fmt(vm.fanRpm, 0)} RPM · Buffer TW (3-45): ${fmt(vm.bufferTemp, 1)} °C · Pomp (3-80): ${onOff(vm.mainPumpState)}`);
    setText('sc-hc-wp-label', `Buiten T4: ${fmt(vm.t1, 1)} °C`);
    setText('sc-hc-curve-val', `${fmt(vm.curveHeatingSetpoint, 1)} °C`);
    setText('sc-hc-diy-val', `${fmt(vm.heatSetpoint, 1)} °C`);
    // These fields describe groups; the snapshot does not provide measured poll intervals.
    ['sf', 'fast', 'med', 'slow'].forEach((group) => setText(`sc-poll-${group}`, ''));
    setText('sc-cal-curr', `${fmt(vm.currentA, 1)} A (×0,1)`);
    setText('sc-cal-volt', `${fmt(vm.voltageV, 0)} V`);
    setText('sc-cal-proto', 'FC04 / FC03');
    setText('sc-sankey-elec', `${fmt(vm.elecKw, 2)} kW`);
    setText('sc-sankey-th', `${fmt(vm.thKw, 2)} kW_th`);
    if (vm.elecKw === null || vm.thKw === null) setText('sc-sankey-env', '— kW');

    setText('sc-sankey-th-total', '');

    const hasWorkpoint = vm.t1 !== null && vm.heatSetpoint !== null;
    ['vline', 'hline', 'dot', 'ring'].forEach((key) => setAttr(`sc-hc-${key}`, 'visibility', hasWorkpoint ? 'visible' : 'hidden'));
  }

  function renderAurora3Demo() {
    const sensors = {};
    Object.entries({
      ambientT4: 7.4,
      outerCoilT3: 3.8,
      suctionTH: 5.1,
      dischargeTP: 68.4,
      retourTE1: 30.2,
      aanvoerTA: 35.2,
      dhwTankTemp: 51.8,
      bufferTankTemp: 33.4,
      totalOutlet: 35.4,
      compRunningFreq: 48,
      compTargetFreq: 48,
      compPhaseI: 5.8,
      fanSpeed: 540,
      eevStep: 240,
      pumpPwm: 65,
      mainPumpState: 1,
      fourWayValveState: 0,
      highPressure: 2400,
      lowPressure: 800,
      roomTemp: 20.6,
    }).forEach(([key, value]) => {
      sensors[key] = { value };
    });
    const demo = normalizeModbus('aurora3', {
      sensors,
      cop: {
        flowLpm: 20, thermalPowerKw: 6.98, electricalPowerKw: 1.6, cop: 4.36,
      },
      power: { inputVoltageV: 230, inputCurrentA: 6.96 },
      control: {
        modeName: 'Verwarmen',
        heatingSetpointC: 35,
        dhwSetpointC: 53,
        curveHeatingSetpointC: 35,
        backupHeaterForced: false,
      },
      status: { compressorOn: true, antifreeze: false, sterilization: false },
    }, [{ id: 'target_temperature.indoor', value: 20.5 }]);
    demo.title = 'DEMO — Aurora III · Voorbeelddata';
    update(demo);
  }

  function wireToolbar() {
    const savedTheme = localStorage.getItem('adlar-schema-theme') || 'auto';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.querySelectorAll('[data-set-theme]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-set-theme') === savedTheme);
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-set-theme');
        document.documentElement.setAttribute('data-theme', mode);
        localStorage.setItem('adlar-schema-theme', mode);
        document.querySelectorAll('[data-set-theme]').forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    document.querySelectorAll('[data-set-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentMode = btn.getAttribute('data-set-mode');
        document.querySelectorAll('[data-set-mode]').forEach((b) => b.classList.toggle('active', b === btn));
        if (currentMode === 'demo' && mountedContainer) {
          mountedContainer.innerHTML = getTemplateForDriver(mountedDriver, true);
          setText('sc-title', `DEMO — ${mountedDriver} · Voorbeelddata`);
          if (mountedDriver === 'aurora3') renderAurora3Demo();
        } else if (currentMode === 'live') {
          mountedContainer.innerHTML = getTemplateForDriver(mountedDriver);
          update(lastLiveVm || (mountedDriver === 'tuya' ? normalizeTuya({}, [], {}) : normalizeModbus(mountedDriver, {}, [])));
        }
      });
    });
  }

  async function pollOnce() {
    try {
      const [snapRes, capRes] = await Promise.all([
        fetch('/api/snapshot'),
        fetch('/api/capabilities'),
      ]);
      const dot = document.getElementById('conn-dot');
      const lbl = document.getElementById('conn-label');
      if (snapRes.status === 204 || !snapRes.ok) {
        if (dot) dot.className = 'degraded';
        if (lbl) lbl.textContent = 'Wachten op eerste meting';
        return;
      }
      const snap = await snapRes.json();
      const caps = capRes.ok ? await capRes.json() : [];
      const q = snap?.diagnostics?.connectionQuality || 'online';
      if (dot) dot.className = q;
      if (lbl) lbl.textContent = q === 'online' ? 'Verbonden · Live (5 s)' : `Status: ${q}`;
      if (lbl && currentMode === 'demo') lbl.textContent = 'Voorbeelddata · Demo';

      lastLiveVm = normalizeModbus(mountedDriver, snap, caps);
      if (currentMode === 'live') {
        update(lastLiveVm);
      }
    } catch {
      const dot = document.getElementById('conn-dot');
      const lbl = document.getElementById('conn-label');
      if (dot) dot.className = 'offline';
      if (lbl) lbl.textContent = 'Verbinding verbroken';
    }
  }

  function startPolling(driverType, container) {
    mount(container, driverType);
    wireToolbar();
    pollOnce().catch(() => {});
    window.setInterval(() => {
      pollOnce().catch(() => {});
    }, 5000);
  }

  function updateFromTuya(container, snap, capList, hcPayload) {
    mount(container, 'tuya');
    lastLiveVm = normalizeTuya(snap, capList, hcPayload);
    if (currentMode === 'live') {
      update(lastLiveVm);
    }
  }

  window.AdlarSchemaRenderer = {
    mount,
    update,
    startPolling,
    updateFromTuya,
    wireToolbar,
  };

  if (document.body && document.body.dataset.driver) {
    const wrap = document.getElementById('schema-wrap');
    if (wrap) startPolling(document.body.dataset.driver, wrap);
  }
})();
