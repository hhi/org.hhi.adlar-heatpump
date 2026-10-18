/* eslint-disable no-console */

'use strict';

/**
 * Capability-eigenaarschap per driver (ADR-001 §4, ADR-004 fase 0).
 *
 * - rapporteert per custom capability welke driver(s) hem gebruiken;
 * - groepeert gedeelde capabilities per driver-combinatie: een wijziging aan zo'n
 *   definitie raakt al die drivers;
 * - faalt op wezen (gedefinieerd, aan geen enkele driver toegewezen).
 *
 * Gebruik: node scripts/check-capability-ownership.js [projectroot]
 */

const fs = require('fs');
const path = require('path');

// Capabilities die bewust alleen runtime via addCapability() bestaan en
// dus terecht niet in driver.compose.json staan (Tuya: DiagnosticCapabilities.connection).
const RUNTIME_ONLY = new Set([
  'adlar_daily_disconnect_count',
  'adlar_zombie_detections_daily',
  'adlar_connection_diagnostics',
]);

// Bekende wezen: gedefinieerd, nergens gebruikt. Opruimen staat open sinds
// IMPLEMENTATIEPLAN-v3 fase 4. Ze laten de controle niet falen; elke nieuwe wees wel.
const KNOWN_ORPHANS = new Set([
  'adlar_measure_pressure_effluent_temp',
  'adlar_measure_pressure_temp_current',
]);

const ROOT = process.argv[2] || process.cwd();
const CAP_DIR = path.join(ROOT, '.homeycompose', 'capabilities');
const DRIVERS_DIR = path.join(ROOT, 'drivers');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const defs = fs.readdirSync(CAP_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .sort();

const drivers = fs.readdirSync(DRIVERS_DIR)
  .filter((d) => fs.existsSync(path.join(DRIVERS_DIR, d, 'driver.compose.json')))
  .sort()
  .map((d) => ({
    id: d,
    caps: new Set(
      (readJson(path.join(DRIVERS_DIR, d, 'driver.compose.json')).capabilities || [])
        .map((c) => c.split('.')[0]), // sub-capabilities normaliseren
    ),
  }));

const owners = new Map(defs.map((c) => [c, drivers.filter((d) => d.caps.has(c)).map((d) => d.id)]));
const unassigned = defs.filter((c) => owners.get(c).length === 0);
const runtimeOnly = unassigned.filter((c) => RUNTIME_ONLY.has(c));
const knownOrphans = unassigned.filter((c) => KNOWN_ORPHANS.has(c));
const orphans = unassigned.filter((c) => !RUNTIME_ONLY.has(c) && !KNOWN_ORPHANS.has(c));
const shared = defs.filter((c) => owners.get(c).length > 1);

// Gedeelde capabilities per driver-combinatie (bijv. Tuya+A2, A2+A3, alle drie)
const byCombination = new Map();
for (const c of shared) {
  const key = owners.get(c).join(' + ');
  if (!byCombination.has(key)) byCombination.set(key, []);
  byCombination.get(key).push(c);
}

console.log(`Capability-eigenaarschap (${defs.length} definities, ${drivers.length} drivers)\n`);
for (const d of drivers) {
  const own = defs.filter((c) => owners.get(c).length === 1 && owners.get(c)[0] === d.id);
  console.log(`  ${d.id}: ${own.length} exclusief`);
}
console.log(`  GEDEELD door meerdere drivers: ${shared.length}`);
console.log(`  ALLEEN RUNTIME (allowlist)   : ${runtimeOnly.length}`);
console.log(`  BEKENDE WEES (allowlist)     : ${knownOrphans.length}`);
console.log(`  WEES (nergens toegewezen)    : ${orphans.length}`);

for (const [combination, caps] of byCombination) {
  console.log(`\nGedeeld door ${combination} (${caps.length}) — een wijziging hier raakt al deze drivers:`);
  caps.forEach((c) => console.log(`   ${c}`));
}
if (knownOrphans.length) {
  console.log('\n⚠️  Bekende wezen — nog op te ruimen:');
  knownOrphans.forEach((c) => console.log(`   ${c}`));
}
if (orphans.length) {
  console.log('\n❌ Nieuwe wezen — gedefinieerd maar aan geen enkele driver toegewezen:');
  orphans.forEach((c) => console.log(`   ${c}`));
  process.exitCode = 1;
} else {
  console.log('\n✅ Geen nieuwe wezen.');
}
