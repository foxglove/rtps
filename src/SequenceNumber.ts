export class SequenceNumber {
  static None = new SequenceNumber(0, 0);
  static Unknown = new SequenceNumber(-1, 0);

  constructor(public high: number, public low: number) {
    if (low < 0) {
      throw new Error(
        `Low value of SequenceNumber cannot be negative, got { high: ${high}, low: ${low} }`,
      );
    }
  }

  write(output: DataView, offset: number, littleEndian: boolean): void {
    output.setInt32(offset, this.high, littleEndian);
    output.setUint32(offset + 4, this.low, littleEndian);
  }

  asBigInt(): bigint {
    return (BigInt(this.high) << 32n) | BigInt(this.low);
  }

  static fromData(view: DataView, offset: number, littleEndian: boolean): SequenceNumber {
    return new SequenceNumber(
      view.getInt32(offset, littleEndian),
      view.getUint32(offset + 4, littleEndian),
    );
  }

  static fromBigInt(value: bigint): SequenceNumber {
    return new SequenceNumber(Number(value >> 32n), Number(value & 0xffffffffn));
  }
}
