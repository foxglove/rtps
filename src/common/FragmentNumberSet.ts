const MAX_BITS = 256;
const MAX_ITEMS = 8;

export class FragmentNumberSet {
  readonly base: number;
  readonly numBits: number;
  readonly bitmap: Uint32Array;

  get size(): number {
    const numLongs = Math.floor((this.numBits + 31) / 32);
    return 4 + 4 + numLongs * 4;
  }

  constructor(base: number, numBits: number, bitmap?: Uint32Array) {
    this.base = base;
    this.numBits = Math.min(numBits, MAX_BITS);
    this.bitmap = new Uint32Array(MAX_ITEMS);
    if (bitmap != undefined) {
      this.bitmap.set(bitmap.length > MAX_ITEMS ? bitmap.slice(0, MAX_ITEMS) : bitmap);
    }
  }

  empty(): boolean {
    return this.numBits === 0;
  }

  add(fragmentNum: number): boolean {
    const idx = Number(fragmentNum - this.base);
    if (idx < 0 || idx >= this.numBits) {
      return false;
    }
    const offset = idx >> 5;
    this.bitmap[offset] |= 1 << (31 - (idx & 31));
    return true;
  }

  write(output: DataView, offset: number, littleEndian: boolean): void {
    output.setUint32(offset, this.base, littleEndian);
    output.setUint32(offset + 4, this.numBits, littleEndian);
    const numLongs = Math.floor((this.numBits + 31) / 32);
    for (let i = 0; i < numLongs; i++) {
      output.setUint32(offset + 8 + i * 4, this.bitmap[i]!, littleEndian);
    }
  }

  maxFragmentNumber(): number {
    const max = this.base + this.numBits - 1;
    return max >= 0 ? max : 0;
  }

  *fragmentNumbers(): Generator<number> {
    let offset = 0;
    let idx = 0;
    for (let i = 0; i < this.numBits; i += 32) {
      const data = this.bitmap[offset++] ?? 0;
      for (let j = 0; j < 32; j++) {
        const datamask = 1 << (31 - j);
        if ((data & datamask) === datamask) {
          yield this.base + idx;
        }
        ++idx;
        if (idx >= this.numBits) {
          break;
        }
      }
    }
  }

  toString(): string {
    const missing = Array.from(this.fragmentNumbers());
    return `FragmentNumberSet<base=${this.base}, numBits=${this.numBits}, missing=[${missing.join(
      ",",
    )}]>`;
  }

  static fromData(view: DataView, offset: number, littleEndian: boolean): FragmentNumberSet {
    const bitmapBase = view.getUint32(offset, littleEndian);
    const numBits = view.getUint32(offset + 4, littleEndian);
    const numLongs = Math.floor((numBits + 31) / 32);
    const bitmap = new Uint32Array(MAX_ITEMS);
    for (let i = 0; i < numLongs; i++) {
      bitmap[i] = view.getUint32(offset + 8 + i * 4, littleEndian);
    }
    return new FragmentNumberSet(bitmapBase, numBits, bitmap);
  }
}
