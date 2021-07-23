import { CdrReader, CdrWriter } from "@foxglove/cdr";

import {
  generateGuidPrefix,
  guidPrefixFromCDR,
  guidPrefixFromData,
  makeGuidPrefix,
  writeGuidPrefix,
  writeGuidPrefixToCDR,
} from "./GuidPrefix";

describe("GuidPrefix", () => {
  it("makeGuidPrefix", () => {
    expect(makeGuidPrefix(0, 0, 0)).toEqual("000000000000000000000000");
    expect(makeGuidPrefix(1, 2, 3)).toEqual("000000010000000200000003");
    expect(makeGuidPrefix(0x01234567, 0x89abcdef, 0xcafef00d)).toEqual("0123456789abcdefcafef00d");
  });

  it("generateGuidPrefix", () => {
    expect(generateGuidPrefix()).toHaveLength(24);
    const a = generateGuidPrefix();
    const b = generateGuidPrefix();
    expect(a).not.toEqual(b);
  });

  it("guidPrefixFromData", () => {
    const data = new Uint8Array(13);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    expect(guidPrefixFromData(view, 1)).toEqual("000000000000000000000000");
    data.set([0x42, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xca, 0xfe, 0xf0, 0x0d]);
    expect(guidPrefixFromData(view, 1)).toEqual("0123456789abcdefcafef00d");
  });

  it("guidPrefixFromCDR", () => {
    // little endian
    const data = new Uint8Array([
      0x00, 0x01, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xca, 0xfe, 0xf0,
      0x0d,
    ]);
    let reader = new CdrReader(data);
    expect(guidPrefixFromCDR(reader)).toEqual("0123456789abcdefcafef00d");
    // big endian
    data.set([
      0x00, 0x00, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xca, 0xfe, 0xf0,
      0x0d,
    ]);
    reader = new CdrReader(data);
    expect(guidPrefixFromCDR(reader)).toEqual("0123456789abcdefcafef00d");
  });

  it("writeGuidPrefix", () => {
    const data = new Uint8Array(13);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    data[0] = 0x42;
    writeGuidPrefix("0123456789abcdefcafef00d", view, 1);
    expect(Array.from(data.values())).toEqual([
      0x42, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xca, 0xfe, 0xf0, 0x0d,
    ]);
  });

  it("writeGuidPrefixToCDR", () => {
    const writer = new CdrWriter();
    writeGuidPrefixToCDR("0123456789abcdefcafef00d", writer);
    expect(Array.from(writer.data.values())).toEqual([
      0x00, 0x01, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xca, 0xfe, 0xf0,
      0x0d,
    ]);
  });
});
