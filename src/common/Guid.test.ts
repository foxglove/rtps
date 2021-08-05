import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { guidFromCDR, guidParts, makeGuid, writeGuidToCDR } from "./Guid";

describe("Guid", () => {
  it("makeGuid", () => {
    expect(makeGuid("000000000000000000000000", 0)).toEqual("00000000000000000000000000000000");
    expect(makeGuid("0123456789abcdefcafef00d", 0xabcdef12)).toEqual("0123456789abcdefcafef00dabcdef12"); // prettier-ignore
  });

  it("guidFromCDR", () => {
    // little endian
    const data = new Uint8Array([
      0x00, 0x01, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xca, 0xfe, 0xf0,
      0x0d, 0xab, 0xcd, 0xef, 0x12,
    ]);
    let reader = new CdrReader(data);
    expect(guidFromCDR(reader)).toEqual("0123456789abcdefcafef00dabcdef12");
    // big endian
    data.set([
      0x00, 0x00, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xca, 0xfe, 0xf0,
      0x0d, 0xab, 0xcd, 0xef, 0x12,
    ]);
    reader = new CdrReader(data);
    expect(guidFromCDR(reader)).toEqual("0123456789abcdefcafef00dabcdef12");
  });

  it("writeGuidToCDR", () => {
    const writer = new CdrWriter();
    writeGuidToCDR("0123456789abcdefcafef00dabcdef12", writer);
    expect(Array.from(writer.data.values())).toEqual([
      0x00, 0x01, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xca, 0xfe, 0xf0,
      0x0d, 0xab, 0xcd, 0xef, 0x12,
    ]);
  });

  it("guidParts", () => {
    const guidPrefix = "0123456789abcdefcafef00d";
    const entityId = 0xabcdef12;
    expect(guidParts("0123456789abcdefcafef00dabcdef12")).toEqual([guidPrefix, entityId]);
  });
});
