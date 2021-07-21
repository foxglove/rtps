export class ReaderSNState {
  constructor(public bitmapBase: bigint, public numBits: number, public bitmap: number) {}

  received(): bigint[] {
    // FIXME
    return [];
  }

  lost(): bigint[] {
    // FIXME
    return [];
  }

  write(output: DataView, offset: number, littleEndian: boolean): void {
    output.setBigUint64(offset, this.bitmapBase, littleEndian);
    output.setUint32(offset + 8, this.numBits, littleEndian);
    output.setUint32(offset + 12, this.bitmap, littleEndian);
  }

  static fromData(view: DataView, offset: number, littleEndian: boolean): ReaderSNState {
    return new ReaderSNState(
      view.getBigUint64(offset, littleEndian),
      view.getUint32(offset + 8),
      view.getUint32(offset + 12),
    );
  }
}
