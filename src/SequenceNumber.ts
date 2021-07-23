export const SequenceNumberNone = 0n;
export const SequenceNumberUnknown = -1n << 32n;

export function sequenceNumberFromData(
  view: DataView,
  offset: number,
  littleEndian: boolean,
): bigint {
  const high = view.getInt32(offset, littleEndian);
  const low = view.getInt32(offset + 4, littleEndian);
  return (BigInt(high) << 32n) | BigInt(low);
}

export function sequenceNumberToData(
  value: bigint,
  view: DataView,
  offset: number,
  littleEndian: boolean,
): void {
  const high = Number(value >> 32n);
  const low = Number(value & 0xffffffffn);
  view.setInt32(offset, high, littleEndian);
  view.setUint32(offset + 4, low, littleEndian);
}
