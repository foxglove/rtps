import { sequenceNumberFromData, sequenceNumberToData } from "./SequenceNumber";

describe("SequenceNumber", () => {
  it("sequenceNumberFromData", () => {
    const data = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const view = new DataView(data.buffer);
    expect(sequenceNumberFromData(view, 0, true)).toEqual(0n);
    data.set([0, 0, 0, 0, 1, 0, 0, 0]);
    expect(sequenceNumberFromData(view, 0, true)).toEqual(1n);
    data.set([1, 0, 0, 0, 2, 0, 0, 0]);
    expect(sequenceNumberFromData(view, 0, true)).toEqual((1n << 32n) | 2n);
  });

  it("sequenceNumberToData", () => {
    const data = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const view = new DataView(data.buffer);
    sequenceNumberToData(0n, view, 0, true);
    expect(data).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
    sequenceNumberToData(1n, view, 0, true);
    expect(data).toEqual(new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0]));
    sequenceNumberToData(18446744073709551614n, view, 0, true);
    expect(data).toEqual(new Uint8Array([255, 255, 255, 255, 254, 255, 255, 255]));
    sequenceNumberToData(18446744073709551615n, view, 0, true);
    expect(data).toEqual(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]));
  });
});
