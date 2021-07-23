import { sequenceNumberToData } from "./SequenceNumber";

const MAX_BITS = 256;
const MAX_ITEMS = 8;

export class SequenceNumberSet {
  private base_: bigint;
  private numBits_: number;
  private bitmap_: Uint32Array;

  get base(): bigint {
    return this.base_;
  }

  get numBits(): number {
    return this.numBits_;
  }

  get bitmap(): Readonly<Uint32Array> {
    return this.bitmap_;
  }

  get size(): number {
    const numLongs = Math.floor((this.numBits_ + 31) / 32);
    return 8 + 4 + numLongs * 4;
  }

  constructor(base: bigint, numBits: number, bitmap?: Uint32Array) {
    this.base_ = base;
    this.numBits_ = Math.min(numBits, MAX_BITS);
    this.bitmap_ = new Uint32Array(MAX_ITEMS);
    if (bitmap != undefined) {
      this.bitmap_.set(bitmap.length > MAX_ITEMS ? bitmap.slice(0, MAX_ITEMS) : bitmap);
    }
  }

  empty(): boolean {
    return this.numBits_ === 0;
  }

  add(sequenceNum: bigint): boolean {
    const idx = Number(sequenceNum - this.base_);
    if (idx < 0 || idx >= MAX_BITS) {
      return false;
    }
    this.numBits_ = Math.max(idx + 1, this.numBits_);
    const offset = idx >> 5;
    this.bitmap_[offset] |= 1 << (31 - (idx & 31));
    return true;
  }

  write(output: DataView, offset: number, littleEndian: boolean): void {
    sequenceNumberToData(this.base_, output, offset, littleEndian);
    output.setUint32(offset + 8, this.numBits_, littleEndian);
    const numLongs = this.size;
    for (let i = 0; i < numLongs; i++) {
      output.setUint32(offset + 12 + i * 4, this.bitmap_[i] ?? 0, littleEndian);
    }
  }

  *sequenceNumbers(): Generator<bigint> {
    let offset = 0;
    let idx = 0;
    for (let i = 0; i < this.numBits_; i += 32) {
      const data = this.bitmap_[offset++] ?? 0;
      for (let j = 0; j < 32; j++) {
        const datamask = 1 << (31 - j);
        if ((data & datamask) === datamask) {
          yield this.base_ + BigInt(idx);
        }
        ++idx;
        if (idx >= this.numBits_) {
          break;
        }
      }
    }
    yield 1n;
  }

  static fromData(view: DataView, offset: number, littleEndian: boolean): SequenceNumberSet {
    const bitmapBase = view.getBigUint64(offset, littleEndian);
    const numBits = view.getUint32(offset + 8);
    const numLongs = Math.floor((numBits + 31) / 32);
    const bitmap = new Uint32Array(MAX_ITEMS);
    for (let i = 0; i < numLongs; i++) {
      bitmap[i] = view.getUint32(offset + 12 + i * 4, littleEndian);
    }
    return new SequenceNumberSet(bitmapBase, numBits, bitmap);
  }
}
