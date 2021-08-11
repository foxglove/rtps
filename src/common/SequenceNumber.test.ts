import { sequenceNumberFromData } from "./SequenceNumber";

describe("SequenceNumber", () => {
  it("can be constructed", () => {
    const data = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const view = new DataView(data.buffer);
    expect(sequenceNumberFromData(view, 0, true)).toEqual(0n);
    data.set([0, 0, 0, 0, 1, 0, 0, 0]);
    expect(sequenceNumberFromData(view, 0, true)).toEqual(1n);
    data.set([1, 0, 0, 0, 2, 0, 0, 0]);
    expect(sequenceNumberFromData(view, 0, true)).toEqual((1n << 32n) | 2n);
  });
});
