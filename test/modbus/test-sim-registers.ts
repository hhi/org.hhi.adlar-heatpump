/**
 * Test CLI — Schrijft simulatie-registers vanuit adlar-modbus-simuregs.mbs.
 *
 * Vergelijkbaar met test-modbus-service.ts, maar het `init` commando laadt
 * registerwaarden uit het .mbs bestand in plaats van hardcoded waarden.
 *
 * Pad: Homey → Elfin EW11A (RS485-to-TCP, poort 502) → WP Modbus RTU
 *
 * Gebruik:
 *   # Init: schrijf alle registers uit het .mbs bestand naar het apparaat
 *   npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 init
 *
 *   # Init met specifiek .mbs bestand (default: test/modbus/adlar-modbus-simuregs.mbs)
 *   npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 init test/modbus/mijn-scenario.mbs
 *
 *   # Lees 1 register (default: 0x0050 outlet T7)
 *   npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 read 0x0050
 *
 *   # Lees blok van registers
 *   npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 read 0x0040 30
 *
 *   # Schrijf enkelvoudig register
 *   npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 write 0x0305 1
 *
 *   # Dump: toon alle registers die in het .mbs bestand zitten zonder te schrijven
 *   npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 dump
 *
 *   # Poll: lees sleutelsensoren 3x met 5s interval
 *   npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 poll
 *
 * Environment:
 *   MODBUS_PORT=502       (default)
 *   MODBUS_UNIT=1         (default)
 *   DEBUG=0               (debug logging uit)
 *   MBS_FILE=test/modbus/adlar-modbus-simuregs.mbs  (override pad naar .mbs bestand)
 */

import * as fs from 'fs';
import * as path from 'path';

import { ModbusTcpService, PollGroup } from '../../lib/modbus/protocol/modbus-tcp-service';

// ── CLI parsing ──────────────────────────────────────────────────────────────

const HOST = process.argv[2];
const CMD  = process.argv[3] ?? 'init';
const ARGS = process.argv.slice(4);

const PORT    = parseInt(process.env.MODBUS_PORT ?? '502', 10);
const UNIT_ID = parseInt(process.env.MODBUS_UNIT ?? '1', 10);

const DEFAULT_MBS = path.resolve(__dirname, 'adlar-modbus-simuregs.mbs');
const MBS_FILE    = process.env.MBS_FILE
  ? path.resolve(process.env.MBS_FILE)
  : (CMD === 'init' && ARGS[0] && ARGS[0].endsWith('.mbs'))
    ? path.resolve(ARGS[0])
    : DEFAULT_MBS;

if (!HOST) {
  console.log(`
Gebruik:
  npx tsx test/modbus/test-sim-registers.ts <IP> [commando] [args...]

Commando's:
  init  [bestand.mbs]     Schrijf alle registers uit .mbs naar apparaat (default: adlar-modbus-simuregs.mbs)
  dump  [bestand.mbs]     Toon register-inhoud van .mbs bestand zonder schrijven
  read  <register> [n]    Lees n holding registers vanaf adres
  write <register> <val>  Schrijf enkelvoudig register (FC06)
  poll                    Poll sleutelsensoren 3× met 5s interval

Voorbeelden:
  npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 init
  npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 init test/modbus/mijn-scenario.mbs
  npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 dump
  npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 read 0x0040 30
  npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 write 0x0305 1
  npx tsx test/modbus/test-sim-registers.ts 192.168.1.100 poll

Environment:
  MODBUS_PORT=502
  MODBUS_UNIT=1
  MBS_FILE=test/modbus/adlar-modbus-simuregs.mbs
`);
  process.exit(1);
}

// ── .mbs parser ──────────────────────────────────────────────────────────────

interface MbsEntry {
  address: number;
  value: number;
  title: string;
}

function loadMbs(filePath: string): MbsEntry[] {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ .mbs bestand niet gevonden: ${filePath}`);
    process.exit(1);
  }

  let raw: string;
  try {
    // Strip JS-stijl commentaren (// ...) die JSON.parse niet accepteert
    raw = fs.readFileSync(filePath, 'utf-8')
      .replace(/\/\/[^\n]*/g, '')   // verwijder // commentaar
      .replace(/,(\s*[}\]])/g, '$1'); // trailing commas opruimen
  } catch (err) {
    console.error(`❌ Leesfout ${filePath}:`, (err as Error).message);
    process.exit(1);
  }

  let parsed: { holdingReg?: { modbusData: { address: number; registerValue: number; title?: string } }[] };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ JSON-parsefout in ${filePath}:`, (err as Error).message);
    process.exit(1);
  }

  const entries = parsed.holdingReg ?? [];
  return entries.map(e => ({
    address: e.modbusData.address,
    value:   e.modbusData.registerValue,
    title:   e.modbusData.title ?? `0x${e.modbusData.address.toString(16).padStart(4, '0')}`,
  }));
}

// ── Schaalfactoren ───────────────────────────────────────────────────────────

const SCALES: Record<number, { multiply: number; unit: string; label: string }> = {
  0x0000: { multiply: 1,    unit: '',      label: 'Running Status 1 (bitmask)' },
  0x0001: { multiply: 1,    unit: '',      label: 'Running Status 2 (bitmask)' },
  0x0040: { multiply: 1,    unit: 'Hz',    label: 'Compressor Freq' },
  0x0041: { multiply: 1,    unit: 'RPM',   label: 'Fan Speed' },
  0x0042: { multiply: 1,    unit: 'P',     label: 'EEV Open Step' },
  0x0047: { multiply: 0.1,  unit: '°C',    label: 'IPM Temp' },
  0x0048: { multiply: 0.1,  unit: '°C',    label: 'HP Sat Temp' },
  0x0049: { multiply: 0.1,  unit: '°C',    label: 'LP Sat Temp' },
  0x004A: { multiply: 0.1,  unit: '°C',    label: 'T1 Ambient' },
  0x004B: { multiply: 0.1,  unit: '°C',    label: 'T2 Outer Coil' },
  0x004C: { multiply: 0.1,  unit: '°C',    label: 'T3 Inner Coil' },
  0x004D: { multiply: 0.1,  unit: '°C',    label: 'T4 Suction' },
  0x004E: { multiply: 0.1,  unit: '°C',    label: 'T5 Exhaust' },
  0x004F: { multiply: 0.1,  unit: '°C',    label: 'T6 Water Inlet' },
  0x0050: { multiply: 0.1,  unit: '°C',    label: 'T7 Water Outlet' },
  0x0051: { multiply: 0.1,  unit: '°C',    label: 'T8 Econ Inlet' },
  0x0052: { multiply: 0.1,  unit: '°C',    label: 'T9 Econ Outlet' },
  0x0054: { multiply: 0.1,  unit: '°C',    label: 'DHW Tank Temp' },
  0x0057: { multiply: 1,    unit: '%',     label: 'Pump PWM' },
  0x0058: { multiply: 1,    unit: 'L/min', label: 'Water Flow' },
  0x0059: { multiply: 0.1,  unit: '°C',    label: 'DHW Return Temp' },
  0x005A: { multiply: 1,    unit: 'V',     label: 'Unit Voltage' },
  0x005B: { multiply: 0.01, unit: 'A',     label: 'Unit Current' },
  0x005C: { multiply: 0.01, unit: 'kW',    label: 'Unit Power' },
  0x005D: { multiply: 1,    unit: 'kWh',   label: 'Total Energy' },
  0x0074: { multiply: 0.1,  unit: '°C',    label: 'Buffer Tank Temp' },
  0x0075: { multiply: 0.1,  unit: '°C',    label: 'Total Outlet Temp' },
  0x0300: { multiply: 0.1,  unit: '°C',    label: 'Cooling Setpoint' },
  0x0301: { multiply: 0.1,  unit: '°C',    label: 'Heating Setpoint' },
  0x0302: { multiply: 0.1,  unit: '°C',    label: 'DHW Setpoint' },
  0x0303: { multiply: 0.1,  unit: '°C',    label: 'Floor Setpoint' },
  0x0304: { multiply: 1,    unit: '',      label: 'Mode (1=Verwarming)' },
  0x0305: { multiply: 1,    unit: '',      label: 'On/Off' },
  0x0306: { multiply: 0.1,  unit: '°C',    label: 'Indoor Setpoint' },
  0x0314: { multiply: 1,    unit: '',      label: 'Heating Curve' },
  0x0360: { multiply: 1,    unit: '',      label: 'Program Version' },
  0x0363: { multiply: 1,    unit: '',      label: 'Protocol Version' },
};

function formatRegister(addr: number, svc: ModbusTcpService): string {
  const raw    = svc.u16(addr);
  const signed = svc.s16(addr);
  const info   = SCALES[addr];
  const scaled = info
    ? (signed * info.multiply).toFixed(info.multiply < 1 ? 2 : 0)
    : signed.toString();
  const unit   = info?.unit  ?? '';
  const label  = info?.label ?? '';

  return [
    `0x${addr.toString(16).padStart(4, '0')}`.padEnd(8),
    raw.toString().padEnd(8),
    signed.toString().padEnd(8),
    scaled.padEnd(12),
    unit.padEnd(8),
    label,
  ].join('');
}

function printHeader(): void {
  console.log('─'.repeat(70));
  console.log(
    'Adres'.padEnd(8), 'Raw'.padEnd(8), 'Signed'.padEnd(8),
    'Scaled'.padEnd(12), 'Eenheid'.padEnd(8), 'Label',
  );
  console.log('─'.repeat(70));
}

// ── Hoofd ────────────────────────────────────────────────────────────────────

async function main() {
  // Dump vereist geen verbinding
  if (CMD === 'dump') {
    const mbsFile = (ARGS[0] && ARGS[0].endsWith('.mbs')) ? path.resolve(ARGS[0]) : MBS_FILE;
    const entries = loadMbs(mbsFile);
    console.log(`\n📄 ${path.basename(mbsFile)} — ${entries.length} registers\n`);
    console.log('─'.repeat(80));
    console.log(
      '#'.padEnd(5), 'Adres'.padEnd(8), 'Hex'.padEnd(8),
      'Raw'.padEnd(8), 'Titel',
    );
    console.log('─'.repeat(80));
    entries.forEach((e, i) => {
      const hex   = `0x${e.address.toString(16).padStart(4, '0')}`;
      const info  = SCALES[e.address];
      const scale = info ? (e.value * info.multiply).toFixed(info.multiply < 1 ? 2 : 0) + ' ' + info.unit : '';
      console.log(
        (i + 1).toString().padEnd(5),
        hex.padEnd(8),
        e.address.toString().padEnd(8),
        e.value.toString().padEnd(8),
        scale ? `[${scale}]  `.padEnd(14) : '              ',
        e.title,
      );
    });
    console.log('─'.repeat(80));
    console.log(`\nTotaal: ${entries.length} registers`);
    process.exit(0);
  }

  // Alle andere commando's vereisen een verbinding
  const svc = new ModbusTcpService({
    host:        HOST,
    port:        PORT,
    unitId:      UNIT_ID,
    timeoutMs:   5_000,
    batchDelayMs: 90,
  });

  svc.setDebug(process.env.DEBUG !== '0');
  svc.on('connected',    ()                                => console.log('✅ Verbonden!\n'));
  svc.on('disconnected', (reason: string)                 => console.log(`\n❌ Verbroken: ${reason}`));
  svc.on('error',        (err: Error, ctx: string)        => console.error(`⚠️  [${ctx}] ${err.message}`));

  console.log(`\nVerbinden met ${HOST}:${PORT} (unit ${UNIT_ID})...`);

  try {
    await svc.connect();
  } catch (err) {
    console.error('❌ Verbinding mislukt:', (err as Error).message);
    process.exit(1);
  }

  try {
    switch (CMD) {

      case 'init': {
        const mbsFile = (ARGS[0] && ARGS[0].endsWith('.mbs')) ? path.resolve(ARGS[0]) : MBS_FILE;
        const entries = loadMbs(mbsFile);

        console.log(`📄 Initialisatie vanuit: ${path.basename(mbsFile)}`);
        console.log(`   ${entries.length} registers schrijven naar ${HOST}:${PORT}\n`);

        let written = 0;
        let skipped = 0;

        for (const entry of entries) {
          const hex = `0x${entry.address.toString(16).padStart(4, '0')}`;
          const info  = SCALES[entry.address];
          const scale = info
            ? ` → ${(entry.value * info.multiply).toFixed(info.multiply < 1 ? 2 : 0)} ${info.unit}`
            : '';
          console.log(`  ${hex} = ${entry.value.toString().padEnd(6)}${scale.padEnd(16)}  ${entry.title}`);

          try {
            await svc.writeSingleRegister(entry.address, entry.value);
            written++;
          } catch (err) {
            console.warn(`  ⚠️  Schrijffout ${hex}: ${(err as Error).message} (overgeslagen)`);
            skipped++;
          }
        }

        // Verificatie: steekproef van sleutelregisters die in het .mbs staan
        const verifyAddrs = [
          0x0000, // Running Status 1
          0x0040, // Compressor Freq
          0x004A, // T1 Ambient
          0x004F, // T6 Water Inlet
          0x0050, // T7 Water Outlet
          0x0058, // Water Flow
          0x005B, // Unit Current
          0x005C, // Unit Power
          0x0301, // Heating Setpoint
          0x0304, // Mode
          0x0305, // On/Off
          0x0363, // Protocol Version
        ].filter(a => entries.some(e => e.address === a));

        if (verifyAddrs.length > 0) {
          console.log('\nVerificatie (steekproef):');
          printHeader();
          for (const addr of verifyAddrs) {
            await svc.readHoldingRegisters(addr, 1);
            console.log(formatRegister(addr, svc));
          }
          console.log('─'.repeat(70));
        }

        console.log(`\n✅ ${written} registers geschreven${skipped > 0 ? `, ${skipped} overgeslagen` : ''}.`);
        console.log("   Draai nu 'poll' om live data te zien.");
        break;
      }

      case 'read': {
        const register = parseInt(ARGS[0] ?? '0x0050', 16);
        const count    = parseInt(ARGS[1] ?? '1', 10);
        console.log(`Lezen: 0x${register.toString(16).padStart(4, '0')}, count=${count}\n`);

        await svc.readHoldingRegisters(register, count);

        printHeader();
        for (let i = 0; i < count; i++) {
          console.log(formatRegister(register + i, svc));
        }
        console.log('─'.repeat(70));
        break;
      }

      case 'write': {
        const register = parseInt(ARGS[0] ?? '0', 16);
        const value    = parseInt(ARGS[1] ?? '0', 10);
        console.log(`Schrijven: 0x${register.toString(16).padStart(4, '0')} = ${value}\n`);

        await svc.writeSingleRegister(register, value);

        await svc.readHoldingRegisters(register, 1);
        printHeader();
        console.log(formatRegister(register, svc));
        console.log('─'.repeat(70));
        console.log('\n✅ Geschreven en geverifieerd.');
        break;
      }

      case 'poll': {
        console.log('Poll-test: sleutelsensoren + control, 3 rondes, 5s interval\n');

        const groups: PollGroup[] = [
          {
            name:       'sensors',
            intervalMs: 5_000,
            blocks: [
              { start: 0x0000, count: 2,  label: 'status' },
              { start: 0x0040, count: 30, label: 'sensors' },
              { start: 0x0072, count: 12, label: 'aux/zone' },
              { start: 0x0300, count: 8,  label: 'control' },
            ],
          },
        ];

        let rounds = 0;
        svc.on('poll-complete', () => {
          rounds++;
          console.log(`\n── Ronde ${rounds} (${new Date().toLocaleTimeString()}) ──`);
          printHeader();

          const highlights = [
            0x0000, // Running Status 1
            0x004A, // T1 Ambient
            0x004F, // T6 Water Inlet
            0x0050, // T7 Water Outlet
            0x0040, // Compressor Freq
            0x0058, // Water Flow
            0x005B, // Unit Current
            0x005C, // Unit Power
            0x0075, // Total Outlet Temp
            0x0301, // Heating Setpoint
            0x0305, // On/Off
          ];
          for (const addr of highlights) {
            if (svc.has(addr)) console.log(formatRegister(addr, svc));
          }
          console.log('─'.repeat(70));
          console.log(`Stats: ${svc.stats.polls} polls, ${svc.stats.errors} errors`);

          if (rounds >= 3) {
            console.log('\n✅ 3 rondes voltooid. Afsluiten.');
            svc.stopPolling();
            svc.destroy().then(() => process.exit(0));
          }
        });

        svc.startPolling(groups);
        await new Promise(r => setTimeout(r, 30_000));
        break;
      }

      default:
        console.error(`Onbekend commando: ${CMD}`);
        process.exit(1);
    }
  } catch (err) {
    console.error('❌ Fout:', (err as Error).message);
  }

  if (CMD !== 'poll') {
    await svc.destroy();
    process.exit(0);
  }
}

main();
