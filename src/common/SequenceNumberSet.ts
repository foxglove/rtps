import { SequenceNumber, sequenceNumberFromData, sequenceNumberToData } from "./SequenceNumber";

const MAX_BITS = 256;
const MAX_ITEMS = 8;

export class SequenceNumberSet {
  readonly base: SequenceNumber;
  readonly numBits: number;
  readonly bitmap: Uint32Array;

  get size(): number {
    const numLongs = Math.floor((this.numBits + 31) / 32);
    return 8 + 4 + numLongs * 4;
  }

  constructor(base: SequenceNumber, numBits: number, bitmap?: Uint32Array) {
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

  add(sequenceNum: SequenceNumber): boolean {
    const idx = Number(sequenceNum - this.base);
    if (idx < 0 || idx >= this.numBits) {
      return false;
    }
    const offset = idx >> 5;
    this.bitmap[offset] |= 1 << (31 - (idx & 31));
    return true;
  }

  write(output: DataView, offset: number, littleEndian: boolean): void {
    sequenceNumberToData(this.base, output, offset, littleEndian);
    output.setUint32(offset + 8, this.numBits, littleEndian);
    const numLongs = Math.floor((this.numBits + 31) / 32);
    for (let i = 0; i < numLongs; i++) {
      output.setUint32(offset + 12 + i * 4, this.bitmap[i]!, littleEndian);
    }
  }

  maxSequenceNumber(): SequenceNumber {
    const max = this.base + BigInt(this.numBits - 1);
    return max >= 0n ? max : 0n;
  }

  *sequenceNumbers(): Generator<SequenceNumber> {
    let offset = 0;
    let idx = 0;
    for (let i = 0; i < this.numBits; i += 32) {
      const data = this.bitmap[offset++] ?? 0;
      for (let j = 0; j < 32; j++) {
        const datamask = 1 << (31 - j);
        if ((data & datamask) === datamask) {
          yield this.base + BigInt(idx);
        }
        ++idx;
        if (idx >= this.numBits) {
          break;
        }
      }
    }
  }

  toString(): string {
    const missing = Array.from(this.sequenceNumbers());
    return `base=${this.base}, numBits=${this.numBits}, missing=[${missing.join(",")}]`;
  }

  static fromData(view: DataView, offset: number, littleEndian: boolean): SequenceNumberSet {
    const bitmapBase = sequenceNumberFromData(view, offset, littleEndian);
    const numBits = view.getUint32(offset + 8, littleEndian);
    const numLongs = Math.floor((numBits + 31) / 32);
    const bitmap = new Uint32Array(MAX_ITEMS);
    for (let i = 0; i < numLongs; i++) {
      bitmap[i] = view.getUint32(offset + 12 + i * 4, littleEndian);
    }
    return new SequenceNumberSet(bitmapBase, numBits, bitmap);
  }
}
