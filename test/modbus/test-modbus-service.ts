/**
 * Test CLI bovenop ModbusTcpService — lezen en schrijven van registers.
 * Valideert dat de generieke transportlaag correct werkt.
 *
 * Pad: Homey → Elfin EW11A (RS485-to-TCP, poort 502) → WP Modbus RTU
 *
 * Gebruik:
 *   # Lees 1 register (default: 0x0050 outlet T7)
 *   npx tsx test/modbus/test-modbus-service.ts 192.168.1.100
 *
 *   # Lees specifiek register
 *   npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 read 0x004A
 *
 *   # Lees blok van 4 registers
 *   npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 read 0x0040 4
 *
 *   # Schrijf register (bijv. ON_OFF = 1)
 *   npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 write 0x0305 1
 *
 *   # Batch: meerdere registers schrijven in 1 sessie
 *   npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 batch 0x0040=42 0x004A=85 0x0050=402
 *
 *   # Init: vul alle sensorregisters met realistische warmtepomp testwaarden
 *   npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 init
 *
 *   # Poll-test: lees sensoren 3x met 5s interval
 *   npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 poll
 *
 * Environment:
 *   MODBUS_PORT=502       (default)
 *   MODBUS_UNIT=1         (default)
 *   DEBUG=0               (debug logging uit)
 */

import { ModbusTcpService, PollGroup } from '../../lib/modbus/protocol/modbus-tcp-service';

// ── CLI parsing ──────────────────────────────────────────────────────────────

const HOST   = process.argv[2];
const CMD    = process.argv[3] ?? 'read';
const ARGS   = process.argv.slice(4);

const PORT    = parseInt(process.env.MODBUS_PORT ?? '502', 10);
const UNIT_ID = parseInt(process.env.MODBUS_UNIT ?? '1', 10);

if (!HOST) {
  console.log(`
Gebruik:
  npx tsx test/modbus/test-modbus-service.ts <IP> [commando] [args...]

Commando's:
  read  <register> [count]            Lees holding registers (default: 0x0050, count=1)
  write <register> <value>            Schrijf register (FC06)
  batch <addr=val> [addr=val] ...     Schrijf meerdere registers in 1 sessie
  init                                Vul registers met realistische WP testwaarden
  poll                                Poll sensoren 3x met 5s interval

Voorbeelden:
  npx tsx test/modbus/test-modbus-service.ts 192.168.1.100                              # Lees T7 outlet
  npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 read 0x004A                  # Lees T1 ambient
  npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 read 0x0040 4                # 4 registers
  npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 write 0x0305 1               # Zet AAN
  npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 batch 0x0040=42 0x004A=85    # Batch write
  npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 init                         # Preset testdata
  npx tsx test/modbus/test-modbus-service.ts 192.168.1.100 poll                         # Poll-test
`);
  process.exit(1);
}


// ── Preset: realistische warmtepomp testwaarden ─────────────────────────────

const INIT_VALUES: [number, number, string][] = [
  // Sensoren
  [0x0040,  42,  'Compressor 42 Hz'],
  [0x0041, 680,  'Fan 680 RPM'],
  [0x0042, 312,  'EEV 312 stappen'],
  [0x004A,  85,  'T1 Ambient = 8.5°C'],
  [0x004B,  52,  'T2 Outer coil = 5.2°C'],
  [0x004C, 380,  'T3 Inner coil = 38.0°C'],
  [0x004D, 120,  'T4 Suction = 12.0°C'],
  [0x004E, 720,  'T5 Exhaust = 72.0°C'],
  [0x004F, 352,  'T6 Inlet = 35.2°C'],
  [0x0050, 402,  'T7 Outlet = 40.2°C'],
  [0x0054, 528,  'DHW Tank = 52.8°C'],
  [0x0057,  65,  'Pump 65%'],
  [0x0058,  18,  'Flow 18 L/min'],
  [0x005A, 230,  '230V'],
  [0x005B, 450,  'Stroom 4.50A (×0.01)'],
  [0x005C, 103,  'Vermogen 1.03 kW (×0.01)'],
  [0x005D, 1847, 'Totaal 1847 kWh'],
  // Control
  [0x0300,  70,  'Cooling SP = 7.0°C'],
  [0x0301, 400,  'Heating SP = 40.0°C'],
  [0x0302, 550,  'DHW SP = 55.0°C'],
  [0x0303, 350,  'Floor SP = 35.0°C'],
  [0x0304,   1,  'Mode = Verwarming'],
  [0x0305,   1,  'On/Off = AAN'],
];


// ── Bekende schaalfactoren ───────────────────────────────────────────────────

const SCALES: Record<number, { multiply: number; unit: string; label: string }> = {
  0x0040: { multiply: 1,    unit: 'Hz',    label: 'Compressor Freq' },
  0x0041: { multiply: 1,    unit: 'RPM',   label: 'Fan Speed' },
  0x0042: { multiply: 1,    unit: 'P',     label: 'EEV Open Step' },
  0x0043: { multiply: 1,    unit: 'P',     label: 'EVI Valve Step' },
  0x0048: { multiply: 0.1,  unit: '°C',    label: 'HP Sat Temp' },
  0x0049: { multiply: 0.1,  unit: '°C',    label: 'LP Sat Temp' },
  0x004A: { multiply: 0.1,  unit: '°C',    label: 'Ambient T1' },
  0x004B: { multiply: 0.1,  unit: '°C',    label: 'Outer Coil T2' },
  0x004C: { multiply: 0.1,  unit: '°C',    label: 'Inner Coil T3' },
  0x004D: { multiply: 0.1,  unit: '°C',    label: 'Suction T4' },
  0x004E: { multiply: 0.1,  unit: '°C',    label: 'Exhaust T5' },
  0x004F: { multiply: 0.1,  unit: '°C',    label: 'Water Inlet T6' },
  0x0050: { multiply: 0.1,  unit: '°C',    label: 'Water Outlet T7' },
  0x0051: { multiply: 0.1,  unit: '°C',    label: 'Economizer In T8' },
  0x0052: { multiply: 0.1,  unit: '°C',    label: 'Economizer Out T9' },
  0x0054: { multiply: 0.1,  unit: '°C',    label: 'DHW Tank Temp' },
  0x0057: { multiply: 1,    unit: '%',     label: 'Pump PWM' },
  0x0058: { multiply: 1,    unit: 'L/min', label: 'Water Flow' },
  0x005A: { multiply: 1,    unit: 'V',     label: 'Unit Voltage' },
  0x005B: { multiply: 0.01, unit: 'A',     label: 'Unit Current' },
  0x005C: { multiply: 0.01, unit: 'kW',    label: 'Unit Power' },
  0x005D: { multiply: 1,    unit: 'kWh',   label: 'Total Energy' },
  0x0300: { multiply: 0.1,  unit: '°C',    label: 'Cooling Setpoint' },
  0x0301: { multiply: 0.1,  unit: '°C',    label: 'Heating Setpoint' },
  0x0302: { multiply: 0.1,  unit: '°C',    label: 'DHW Setpoint' },
  0x0303: { multiply: 0.1,  unit: '°C',    label: 'Floor Setpoint' },
  0x0304: { multiply: 1,    unit: '',      label: 'Mode (0-7)' },
  0x0305: { multiply: 1,    unit: '',      label: 'On/Off' },
  0x0314: { multiply: 1,    unit: '',      label: 'Heating Curve' },
  0x0363: { multiply: 1,    unit: '',      label: 'Protocol Version' },
};

function formatRegister(addr: number, svc: ModbusTcpService): string {
  const raw    = svc.u16(addr);
  const signed = svc.s16(addr);
  const info   = SCALES[addr];
  const scaled = info ? (signed * info.multiply).toFixed(info.multiply < 1 ? 2 : 0) : signed.toString();
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


// ── Hoofd ────────────────────────────────────────────────────────────────────

async function main() {
  const svc = new ModbusTcpService({
    host: HOST,
    port: PORT,
    unitId: UNIT_ID,
    timeoutMs: 5_000,
    batchDelayMs: 90,
  });

  // Debug logging standaard aan (uit met DEBUG=0)
  svc.setDebug(process.env.DEBUG !== '0');

  // Event handlers
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

  const header = () => {
    console.log('─'.repeat(60));
    console.log(
      'Adres'.padEnd(8), 'Raw'.padEnd(8), 'Signed'.padEnd(8),
      'Scaled'.padEnd(12), 'Eenheid'.padEnd(8), 'Label'
    );
    console.log('─'.repeat(60));
  };

  try {
    switch (CMD) {

      case 'read': {
        const register = parseInt(ARGS[0] ?? '0x0050', 16);
        const count    = parseInt(ARGS[1] ?? '1', 10);
        console.log(`Lezen: 0x${register.toString(16).padStart(4, '0')}, count=${count}\n`);

        await svc.readHoldingRegisters(register, count);

        header();
        for (let i = 0; i < count; i++) {
          console.log(formatRegister(register + i, svc));
        }
        console.log('─'.repeat(60));
        break;
      }

      case 'write': {
        const register = parseInt(ARGS[0] ?? '0', 16);
        const value    = parseInt(ARGS[1] ?? '0', 10);
        console.log(`Schrijven: 0x${register.toString(16).padStart(4, '0')} = ${value}\n`);

        await svc.writeSingleRegister(register, value);

        // Verificatie: teruglezen
        await svc.readHoldingRegisters(register, 1);
        header();
        console.log(formatRegister(register, svc));
        console.log('─'.repeat(60));
        console.log(`\n✅ Geschreven en geverifieerd.`);
        break;
      }

      case 'batch': {
        if (ARGS.length === 0) {
          console.error('Gebruik: batch 0x0040=42 0x004A=85 ...');
          process.exit(1);
        }

        const pairs = ARGS.map(arg => {
          const [addrStr, valStr] = arg.split('=');
          return { addr: parseInt(addrStr, 16), value: parseInt(valStr, 10) };
        });

        console.log(`Batch schrijven: ${pairs.length} registers\n`);

        for (const { addr, value } of pairs) {
          await svc.writeSingleRegister(addr, value);
        }

        // Verificatie: teruglezen
        console.log('\nVerificatie:');
        header();
        for (const { addr } of pairs) {
          await svc.readHoldingRegisters(addr, 1);
          console.log(formatRegister(addr, svc));
        }
        console.log('─'.repeat(60));
        console.log(`\n✅ ${pairs.length} registers geschreven en geverifieerd.`);
        break;
      }

      case 'init': {
        console.log(`Initialisatie: ${INIT_VALUES.length} registers met realistische WP testwaarden\n`);

        for (const [addr, value, desc] of INIT_VALUES) {
          const addrHex = `0x${addr.toString(16).padStart(4, '0')}`;
          console.log(`  ${addrHex} = ${value.toString().padEnd(6)} ${desc}`);
          await svc.writeSingleRegister(addr, value);
        }

        // Verificatie: teruglezen
        console.log('\nVerificatie (steekproef):');
        header();
        const verify = [0x0040, 0x004A, 0x004F, 0x0050, 0x005A, 0x005B, 0x005C, 0x0301, 0x0305];
        for (const addr of verify) {
          await svc.readHoldingRegisters(addr, 1);
          console.log(formatRegister(addr, svc));
        }
        console.log('─'.repeat(60));
        console.log(`\n✅ ${INIT_VALUES.length} registers geïnitialiseerd. Draai nu 'poll' om alles te zien.`);
        break;
      }

      case 'poll': {
        console.log('Poll-test: sensoren + control, 3 rondes, 5s interval\n');

        const groups: PollGroup[] = [
          {
            name: 'sensors',
            intervalMs: 5_000,
            blocks: [
              { start: 0x0040, count: 32, label: 'sensors' },
              { start: 0x0300, count: 8,  label: 'control' },
            ],
          },
        ];

        let rounds = 0;
        svc.on('poll-complete', (groupName: string) => {
          rounds++;
          console.log(`\n── Ronde ${rounds} (${new Date().toLocaleTimeString()}) ──`);
          header();

          const highlights = [
            0x004A, 0x004F, 0x0050, 0x0040, 0x0058,
            0x005A, 0x005B, 0x005C, 0x0301, 0x0305,
          ];
          for (const addr of highlights) {
            if (svc.has(addr)) console.log(formatRegister(addr, svc));
          }
          console.log('─'.repeat(60));
          console.log(`Stats: ${svc.stats.polls} polls, ${svc.stats.errors} errors`);

          if (rounds >= 3) {
            console.log('\n✅ 3 rondes voltooid. Afsluiten.');
            svc.stopPolling();
            svc.destroy().then(() => process.exit(0));
          }
        });

        svc.startPolling(groups);

        // Wacht max 30s
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
