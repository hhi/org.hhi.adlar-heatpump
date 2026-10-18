/**
 * Test CLI — Aurora III simulatie-registers vanuit adlar3-server.mbs.
 *
 * Gebaseerd op test-sim-registers.ts, maar afgestemd op Aurora III:
 *   - inputReg  → FC04 readInputRegisters (3-NNNN, read-only via Modbus)
 *   - holdingReg → FC03/FC06 read/writeHoldingRegisters (4-NNNN)
 *
 * Gebruik:
 *   npx tsx test/test-sim3-registers.ts 192.168.1.100 dump
 *   npx tsx test/test-sim3-registers.ts 192.168.1.100 init
 *   npx tsx test/test-sim3-registers.ts 192.168.1.100 read 38
 *   npx tsx test/test-sim3-registers.ts 192.168.1.100 read-input 38 2
 *   npx tsx test/test-sim3-registers.ts 192.168.1.100 read-holding 2107
 *   npx tsx test/test-sim3-registers.ts 192.168.1.100 write 2107 350
 *   npx tsx test/test-sim3-registers.ts 192.168.1.100 poll
 *
 * Environment:
 *   MODBUS_PORT=502
 *   MODBUS_UNIT=1
 *   DEBUG=0
 *   MBS_FILE=test/aurora3/adlar3-server.mbs
 */

import * as fs from 'fs';
import * as path from 'path';

import { ModbusTcpService, PollGroup } from '../../lib/aurora3/protocol/modbus-tcp-service';
import {
  ALL_HOLDING_REGISTERS,
  ALL_INPUT_REGISTERS,
  decodeS16,
} from '../../lib/aurora3/protocol/adlar3-modbus-registers';

// -- CLI parsing -------------------------------------------------------------

const HOST = process.argv[2];
const CMD = process.argv[3] ?? 'dump';
const ARGS = process.argv.slice(4);

const PORT = parseInt(process.env.MODBUS_PORT ?? '502', 10);
const UNIT_ID = parseInt(process.env.MODBUS_UNIT ?? '1', 10);

const DEFAULT_MBS = path.resolve(process.cwd(), 'test', 'aurora3', 'adlar3-server.mbs');
const MBS_FILE = process.env.MBS_FILE
  ? path.resolve(process.env.MBS_FILE)
  : (ARGS[0] && ARGS[0].endsWith('.mbs'))
    ? path.resolve(ARGS[0])
    : DEFAULT_MBS;

if (!HOST) {
  console.log(`
Gebruik:
  npx tsx test/test-sim3-registers.ts <IP> [commando] [args...]

Commando's:
  dump [bestand.mbs]       Toon inputReg + holdingReg uit .mbs zonder verbinding
  init [bestand.mbs]       Schrijf holdingReg naar simulator; inputReg is read-only via Modbus
  read <register> [n]      Lees slim: input als adres in inputReg zit, anders holding
  read-input <register> [n]    Lees n input registers via FC04
  read-holding <register> [n]  Lees n holding registers via FC03
  write <register> <val>   Schrijf holding register via FC06
  poll                     Poll Aurora III sleutelblokken 3x met 5s interval

Voorbeelden:
  npx tsx test/test-sim3-registers.ts 192.168.1.100 dump
  npx tsx test/test-sim3-registers.ts 192.168.1.100 init
  npx tsx test/test-sim3-registers.ts 192.168.1.100 read 38
  npx tsx test/test-sim3-registers.ts 192.168.1.100 read-holding 2107
  npx tsx test/test-sim3-registers.ts 192.168.1.100 write 2107 350

Environment:
  MODBUS_PORT=502
  MODBUS_UNIT=1
  MBS_FILE=test/aurora3/adlar3-server.mbs
`);
  process.exit(1);
}

// -- .mbs parser -------------------------------------------------------------

type RegisterKind = 'input' | 'holding';

interface MbsEntry {
  kind: RegisterKind;
  address: number;
  value: number;
  title: string;
}

interface MbsRegister {
  modbusData: {
    address: number;
    registerValue: number;
    title?: string;
  };
}

interface MbsFile {
  inputReg?: MbsRegister[];
  holdingReg?: MbsRegister[];
}

function loadMbs(filePath: string): MbsEntry[] {
  if (!fs.existsSync(filePath)) {
    console.error(`.mbs bestand niet gevonden: ${filePath}`);
    process.exit(1);
  }

  let parsed: MbsFile;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/,(\s*[}\]])/g, '$1');
    parsed = JSON.parse(raw) as MbsFile;
  } catch (err) {
    console.error(`Lees- of JSON-parsefout in ${filePath}:`, (err as Error).message);
    process.exit(1);
  }

  const input = (parsed.inputReg ?? []).map((entry) => toEntry('input', entry));
  const holding = (parsed.holdingReg ?? []).map((entry) => toEntry('holding', entry));
  return [...input, ...holding].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'input' ? -1 : 1;
    return a.address - b.address;
  });
}

function toEntry(kind: RegisterKind, entry: MbsRegister): MbsEntry {
  return {
    kind,
    address: entry.modbusData.address,
    value: entry.modbusData.registerValue,
    title: entry.modbusData.title ?? `${kind}:${entry.modbusData.address}`,
  };
}

// -- Register metadata -------------------------------------------------------

interface RegisterMeta {
  multiply: number;
  unit: string;
  label: string;
  signed: boolean;
}

const META = buildMeta();

function buildMeta(): Record<string, RegisterMeta> {
  const result: Record<string, RegisterMeta> = {};
  for (const def of Object.values(ALL_INPUT_REGISTERS)) {
    result[`input:${def.address}`] = {
      multiply: def.multiply ?? 1,
      unit: def.unit ?? '',
      label: def.name,
      signed: def.dataType === 'S16',
    };
  }
  for (const def of Object.values(ALL_HOLDING_REGISTERS)) {
    result[`holding:${def.address}`] = {
      multiply: def.multiply ?? 1,
      unit: def.unit ?? '',
      label: def.name,
      signed: def.dataType === 'S16',
    };
  }
  return result;
}

function keyOf(kind: RegisterKind, address: number): string {
  return `${kind}:${address}`;
}

function parseAddress(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  return value.startsWith('0x') || value.startsWith('0X')
    ? parseInt(value, 16)
    : parseInt(value, 10);
}

function scaledValue(kind: RegisterKind, addr: number, raw: number): string {
  const meta = META[keyOf(kind, addr)];
  const signed = meta?.signed ? decodeS16(raw) : raw;
  const multiply = meta?.multiply ?? 1;
  const decimals = multiply < 1 ? 2 : 0;
  return (signed * multiply).toFixed(decimals);
}

function formatRegister(kind: RegisterKind, addr: number, svc: ModbusTcpService): string {
  const raw = svc.u16(addr);
  const meta = META[keyOf(kind, addr)];
  const signed = meta?.signed ? decodeS16(raw) : svc.s16(addr);
  const scaled = scaledValue(kind, addr, raw);
  const unit = meta?.unit ?? '';
  const label = meta?.label ?? '';

  return [
    kind.padEnd(8),
    addr.toString().padEnd(8),
    raw.toString().padEnd(8),
    signed.toString().padEnd(8),
    scaled.padEnd(12),
    unit.padEnd(8),
    label,
  ].join('');
}

function printHeader(): void {
  console.log('-'.repeat(86));
  console.log(
    'FC'.padEnd(8),
    'Adres'.padEnd(8),
    'Raw'.padEnd(8),
    'Signed'.padEnd(8),
    'Scaled'.padEnd(12),
    'Eenheid'.padEnd(8),
    'Label',
  );
  console.log('-'.repeat(86));
}

function kindForAddress(entries: MbsEntry[], address: number): RegisterKind {
  if (entries.some((entry) => entry.kind === 'input' && entry.address === address)) return 'input';
  return 'holding';
}

// -- Main --------------------------------------------------------------------

async function main(): Promise<void> {
  if (CMD === 'dump') {
    const mbsFile = (ARGS[0] && ARGS[0].endsWith('.mbs')) ? path.resolve(ARGS[0]) : MBS_FILE;
    const entries = loadMbs(mbsFile);
    const inputCount = entries.filter((entry) => entry.kind === 'input').length;
    const holdingCount = entries.filter((entry) => entry.kind === 'holding').length;

    console.log(`\n${path.basename(mbsFile)} - ${inputCount} inputReg, ${holdingCount} holdingReg\n`);
    console.log('-'.repeat(104));
    console.log(
      '#'.padEnd(5),
      'FC'.padEnd(8),
      'Adres'.padEnd(8),
      'Raw'.padEnd(8),
      'Scaled'.padEnd(16),
      'Titel',
    );
    console.log('-'.repeat(104));
    entries.forEach((entry, index) => {
      const scaled = `${scaledValue(entry.kind, entry.address, entry.value)} ${META[keyOf(entry.kind, entry.address)]?.unit ?? ''}`.trim();
      console.log(
        (index + 1).toString().padEnd(5),
        entry.kind.padEnd(8),
        entry.address.toString().padEnd(8),
        entry.value.toString().padEnd(8),
        scaled.padEnd(16),
        entry.title,
      );
    });
    console.log('-'.repeat(104));
    return;
  }

  const svc = new ModbusTcpService({
    host: HOST,
    port: PORT,
    unitId: UNIT_ID,
    timeoutMs: 5_000,
    batchDelayMs: 90,
  });

  svc.setDebug(process.env.DEBUG !== '0');
  svc.on('connected', () => console.log('Verbonden.\n'));
  svc.on('disconnected', (reason) => console.log(`Verbinding verbroken: ${reason}`));
  svc.on('error', (err, ctx) => console.error(`[${ctx}] ${err.message}`));

  console.log(`Verbinden met ${HOST}:${PORT} (unit ${UNIT_ID})...`);
  try {
    await svc.connect();
  } catch (err) {
    console.error('Verbinding mislukt:', (err as Error).message);
    process.exit(1);
  }

  try {
    switch (CMD) {
      case 'init':
        await initHoldingRegisters(svc);
        break;
      case 'read':
        await readSmart(svc);
        break;
      case 'read-input':
        await readBlock(svc, 'input');
        break;
      case 'read-holding':
        await readBlock(svc, 'holding');
        break;
      case 'write':
        await writeHolding(svc);
        break;
      case 'poll':
        await pollAurora3(svc);
        return;
      default:
        console.error(`Onbekend commando: ${CMD}`);
        process.exit(1);
    }
  } finally {
    if (CMD !== 'poll') await svc.destroy();
  }
}

async function initHoldingRegisters(svc: ModbusTcpService): Promise<void> {
  const mbsFile = (ARGS[0] && ARGS[0].endsWith('.mbs')) ? path.resolve(ARGS[0]) : MBS_FILE;
  const entries = loadMbs(mbsFile);
  const input = entries.filter((entry) => entry.kind === 'input');
  const holding = entries.filter((entry) => entry.kind === 'holding');

  console.log(`Initialisatie vanuit: ${path.basename(mbsFile)}`);
  console.log(`inputReg: ${input.length} registers staan in .mbs, maar zijn FC04 read-only via Modbus.`);
  console.log(`holdingReg: ${holding.length} registers worden via FC06 geschreven.\n`);

  let written = 0;
  let skipped = 0;
  for (const entry of holding) {
    console.log(`  4-${entry.address.toString().padStart(4, '0')} = ${entry.value.toString().padEnd(6)} ${entry.title}`);
    try {
      await svc.writeSingleRegister(entry.address, entry.value);
      written++;
    } catch (err) {
      console.warn(`  Schrijffout ${entry.address}: ${(err as Error).message}`);
      skipped++;
    }
  }

  console.log(`\nKlaar: ${written} holding registers geschreven${skipped > 0 ? `, ${skipped} overgeslagen` : ''}.`);
  console.log('Laad inputReg in de virtuele server via het .mbs bestand zelf; FC04-registers zijn niet schrijfbaar via Modbus.');
}

async function readSmart(svc: ModbusTcpService): Promise<void> {
  const entries = loadMbs(MBS_FILE);
  const address = parseAddress(ARGS[0], 38);
  const count = parseInt(ARGS[1] ?? '1', 10);
  const kind = kindForAddress(entries, address);
  await readBlock(svc, kind, address, count);
}

async function readBlock(
  svc: ModbusTcpService,
  kind: RegisterKind,
  addressArg?: number,
  countArg?: number,
): Promise<void> {
  const address = addressArg ?? parseAddress(ARGS[0], kind === 'input' ? 38 : 2100);
  const count = countArg ?? parseInt(ARGS[1] ?? '1', 10);

  console.log(`${kind === 'input' ? 'FC04 input' : 'FC03 holding'} lezen: ${address}, count=${count}\n`);
  if (kind === 'input') {
    await svc.readInputRegisters(address, count);
  } else {
    await svc.readHoldingRegisters(address, count);
  }

  printHeader();
  for (let offset = 0; offset < count; offset++) {
    console.log(formatRegister(kind, address + offset, svc));
  }
  console.log('-'.repeat(86));
}

async function writeHolding(svc: ModbusTcpService): Promise<void> {
  const address = parseAddress(ARGS[0], 2107);
  const value = parseInt(ARGS[1] ?? '350', 10);

  console.log(`FC06 holding schrijven: ${address} = ${value}\n`);
  await svc.writeSingleRegister(address, value);
  await svc.readHoldingRegisters(address, 1);

  printHeader();
  console.log(formatRegister('holding', address, svc));
  console.log('-'.repeat(86));
}

async function pollAurora3(svc: ModbusTcpService): Promise<void> {
  console.log('Poll-test Aurora III: 3 rondes, 5s interval\n');

  const groups: PollGroup[] = [
    {
      name: 'adlar3-test',
      intervalMs: 5_000,
      blocks: [
        { start: 38, count: 2, label: 'status', fc: 'input' },
        { start: 40, count: 17, label: 'temperatures', fc: 'input' },
        { start: 62, count: 3, label: 'pump/flow', fc: 'input' },
        { start: 70, count: 10, label: 'compressor/electric', fc: 'input' },
        { start: 2100, count: 15, label: 'control', fc: 'holding' },
      ],
    },
  ];

  let rounds = 0;
  svc.on('poll-complete', () => {
    rounds++;
    console.log(`\n-- Ronde ${rounds} (${new Date().toLocaleTimeString()}) --`);
    printHeader();
    const highlights: Array<{ kind: RegisterKind; address: number }> = [
      { kind: 'input', address: 38 },
      { kind: 'input', address: 42 },
      { kind: 'input', address: 43 },
      { kind: 'input', address: 50 },
      { kind: 'input', address: 64 },
      { kind: 'input', address: 74 },
      { kind: 'input', address: 75 },
      { kind: 'input', address: 79 },
      { kind: 'holding', address: 2100 },
      { kind: 'holding', address: 2107 },
    ];
    for (const item of highlights) {
      if (svc.has(item.address)) console.log(formatRegister(item.kind, item.address, svc));
    }
    console.log('-'.repeat(86));
    console.log(`Stats: ${svc.stats.polls} polls, ${svc.stats.errors} errors`);

    if (rounds >= 3) {
      console.log('\n3 rondes voltooid. Afsluiten.');
      svc.stopPolling();
      svc.destroy().then(() => process.exit(0)).catch(() => process.exit(1));
    }
  });

  svc.startPolling(groups);
  await new Promise((resolve) => setTimeout(resolve, 30_000));
}

main().catch((err) => {
  console.error('Fout:', (err as Error).message);
  process.exit(1);
});
