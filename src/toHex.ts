const LUT_HEX_4b = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
const LUT_HEX_8b: string[] = new Array<string>(0x100);
for (let n = 0; n < 0x100; n++) {
  LUT_HEX_8b[n] = `${LUT_HEX_4b[(n >>> 4) & 0xf]!}${LUT_HEX_4b[n & 0xf]!}`;
}

export function toHex(buffer: Uint8Array): string {
  let out = "";
  for (let idx = 0, edx = buffer.length; idx < edx; idx++) {
    out += LUT_HEX_8b[buffer[idx]!]!;
  }
  return out;
}

export function toHexSeparated(buffer: Uint8Array, separator = ":"): string {
  let out = "";
  for (let idx = 0, edx = buffer.length; idx < edx; idx++) {
    out += LUT_HEX_8b[buffer[idx]!]!;
    if (idx !== edx - 1) {
      out += separator;
    }
  }
  return out;
}

export function toHexFormatted(buffer: Uint8Array): string {
  let out = "";
  for (let idx = 0, edx = buffer.length; idx < edx; idx++) {
    out += LUT_HEX_8b[buffer[idx]!]!;
    if (idx > 0 && (idx + 1) % 16 === 0) {
      out += "\n";
    } else if (idx > 0 && (idx + 1) % 8 === 0 && (idx + 1) % 16 !== 0) {
      out += "  ";
    } else {
      out += " ";
    }
  }
  return out.trimEnd();
}

export function uint32ToHex(value: number): string {
  const a = (value >> 24) & 0xff;
  const b = (value >> 16) & 0xff;
  const c = (value >> 8) & 0xff;
  const d = value & 0xff;
  return `${LUT_HEX_8b[a]}${LUT_HEX_8b[b]}${LUT_HEX_8b[c]}${LUT_HEX_8b[d]}`;
}
