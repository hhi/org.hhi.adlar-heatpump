export interface ParameterBankRange {
  address: number;
  minAddress: number;
  maxAddress: number;
  status: 'available' | 'partial' | 'unavailable' | 'invalid';
  minRaw?: number;
  maxRaw?: number;
  min?: number;
  max?: number;
  readAt: number;
}

export const PARAMETER_LIMIT_BANKS = [
  {
    id: 'pMax', start: 0x0400, count: 512, parameterStart: 0x0100, kind: 'P', role: 'max',
  },
  {
    id: 'pMin', start: 0x0600, count: 512, parameterStart: 0x0100, kind: 'P', role: 'min',
  },
  {
    id: 'lMax', start: 0x0840, count: 64, parameterStart: 0x0800, kind: 'L', role: 'max',
  },
  {
    id: 'lMin', start: 0x0880, count: 64, parameterStart: 0x0800, kind: 'L', role: 'min',
  },
] as const;

export function parameterBankWord(address: number): { parameterAddress: number; role: 'min' | 'max' } | null {
  if (!Number.isInteger(address)) return null;
  const bank = PARAMETER_LIMIT_BANKS.find((candidate) => address >= candidate.start && address < candidate.start + candidate.count);
  return bank ? { parameterAddress: bank.parameterStart + address - bank.start, role: bank.role } : null;
}

export function validParameterBankRead(start: number, count: number): boolean {
  return Number.isInteger(start) && Number.isInteger(count) && count > 0 && count <= 32
    && PARAMETER_LIMIT_BANKS.some((bank) => start >= bank.start && start + count <= bank.start + bank.count);
}

export function parameterBankAddresses(address: number): { minAddress: number; maxAddress: number } | null {
  if (!Number.isInteger(address)) return null;
  if (address >= 0x0100 && address <= 0x02FF) {
    return { minAddress: address + 0x0500, maxAddress: address + 0x0300 };
  }
  if (address >= 0x0800 && address <= 0x083F) {
    return { minAddress: address + 0x0080, maxAddress: address + 0x0040 };
  }
  return null;
}

function decodeBankWord(raw: number): number {
  return raw > 0x7FFF ? raw - 0x10000 : raw;
}

/** Per-runtime, on-demand read-only metadata. No poll timers or write policy. */
export default class ParameterBankService {
  private readonly cache = new Map<number, ParameterBankRange>();
  private readonly words = new Map<number, number>();
  private pending: Promise<void> = Promise.resolve();
  private generation = 0;

  private readonly readWords: (start: number, count: number) => Promise<number[]>;

  constructor(readWords: (start: number, count: number) => Promise<number[]>) {
    this.readWords = readWords;
  }

  clear(): void {
    this.generation++;
    this.cache.clear();
    this.words.clear();
  }

  getRanges(): ParameterBankRange[] {
    return [...this.cache.values()].map((entry) => ({ ...entry }));
  }

  /** A direct read of either bank contributes to the same per-session range cache. */
  observeWord(address: number, raw: number): void {
    const word = parameterBankWord(address);
    if (!word) return;
    this.words.set(address, raw);
    const pair = parameterBankAddresses(word.parameterAddress)!;
    const minRaw = this.words.get(pair.minAddress);
    const maxRaw = this.words.get(pair.maxAddress);
    if (minRaw !== undefined && maxRaw !== undefined) {
      this.setRange(word.parameterAddress, minRaw, maxRaw);
    } else {
      this.cache.set(word.parameterAddress, {
        address: word.parameterAddress,
        ...pair,
        status: 'partial',
        minRaw,
        maxRaw,
        min: minRaw === undefined ? undefined : decodeBankWord(minRaw),
        max: maxRaw === undefined ? undefined : decodeBankWord(maxRaw),
        readAt: Date.now(),
      });
    }
  }

  invalidateWords(start: number, count: number): void {
    for (let index = 0; index < count; index++) {
      const word = parameterBankWord(start + index);
      if (word) this.markUnavailable(word.parameterAddress);
    }
  }

  private markUnavailable(address: number): void {
    const pair = parameterBankAddresses(address)!;
    this.words.delete(pair.minAddress);
    this.words.delete(pair.maxAddress);
    this.cache.set(address, {
      address, ...pair, status: 'unavailable', readAt: Date.now(),
    });
  }

  async readRanges(addresses: number[], refresh = false): Promise<ParameterBankRange[]> {
    const requested = [...new Set(addresses)].sort((a, b) => a - b);
    if (requested.length === 0 || requested.length > 32 || requested.some((a) => !parameterBankAddresses(a))) {
      throw new Error('Invalid parameter bank addresses');
    }
    const { generation } = this;
    const work = this.pending.catch(() => {}).then(async () => {
      this.assertGeneration(generation);
      const missing = requested.filter((address) => refresh || !this.cache.has(address) || this.cache.get(address)?.status === 'partial');
      // Read contiguous ranges only; gaps and the P/L boundary start new groups.
      while (missing.length) {
        const group = [missing.shift()!];
        while (missing.length && missing[0] === group[group.length - 1] + 1 && group.length < 32) {
          group.push(missing.shift()!);
        }
        const readable = await this.readGroup(group, generation);
        if (!readable) {
          for (const address of missing) {
            this.markUnavailable(address);
          }
          break;
        }
      }
    });
    this.pending = work;
    await work;
    this.assertGeneration(generation);
    return requested.map((address) => ({ ...this.cache.get(address)! }));
  }

  private assertGeneration(generation: number): void {
    if (generation !== this.generation) throw new Error('Modbus session closed');
  }

  private async readGroup(addresses: number[], generation: number): Promise<boolean> {
    const first = parameterBankAddresses(addresses[0])!;
    let minima: number[];
    let maxima: number[];
    try {
      minima = await this.readWords(first.minAddress, addresses.length);
      this.assertGeneration(generation);
      maxima = await this.readWords(first.maxAddress, addresses.length);
      this.assertGeneration(generation);
      if (minima.length !== addresses.length || maxima.length !== addresses.length) {
        throw new Error('Incomplete parameter bank response');
      }
    } catch {
      this.assertGeneration(generation);
      for (const address of addresses) {
        this.markUnavailable(address);
      }
      return false;
    }
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const pair = parameterBankAddresses(address)!;
      this.words.set(pair.minAddress, minima[i]);
      this.words.set(pair.maxAddress, maxima[i]);
      this.setRange(address, minima[i], maxima[i]);
    }
    return true;
  }

  private setRange(address: number, minRaw: number, maxRaw: number): void {
    const min = decodeBankWord(minRaw);
    const max = decodeBankWord(maxRaw);
    const validWords = [minRaw, maxRaw].every((value) => Number.isInteger(value) && value >= 0 && value <= 0xFFFF);
    this.cache.set(address, {
      address,
      ...parameterBankAddresses(address)!,
      status: validWords && min <= max ? 'available' : 'invalid',
      minRaw,
      maxRaw,
      min,
      max,
      readAt: Date.now(),
    });
  }
}
