export function fromHex(hex: string): Uint8Array {
  const match = hex.match(/.{1,2}/g) ?? [];
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}
