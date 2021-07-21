import { SequenceNumber } from "./SequenceNumber";

describe("SequenceNumber", () => {
  it("can be constructed", () => {
    expect(new SequenceNumber(0, 0)).toEqual({ high: 0, low: 0 });
    expect(new SequenceNumber(1, 0)).toEqual({ high: 1, low: 0 });
    expect(new SequenceNumber(0, 1)).toEqual({ high: 0, low: 1 });
    expect(new SequenceNumber(-1, 0)).toEqual({ high: -1, low: 0 });
    expect(() => new SequenceNumber(0, -1)).toThrow();

    expect(SequenceNumber.None).toEqual({ high: 0, low: 0 });
    expect(SequenceNumber.Unknown).toEqual({ high: -1, low: 0 });

    const data = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const view = new DataView(data.buffer);
    expect(SequenceNumber.fromData(view, 0, true)).toEqual({ high: 0, low: 0 });
    data.set([0, 0, 0, 0, 1, 0, 0, 0]);
    expect(SequenceNumber.fromData(view, 0, true)).toEqual({ high: 0, low: 1 });
    data.set([1, 0, 0, 0, 2, 0, 0, 0]);
    expect(SequenceNumber.fromData(view, 0, true)).toEqual({ high: 1, low: 2 });

    expect(SequenceNumber.fromBigInt(0n)).toEqual(SequenceNumber.None);
    expect(SequenceNumber.fromBigInt(1n)).toEqual({ high: 0, low: 1 });
    expect(SequenceNumber.fromBigInt(-1n)).toEqual({ high: -1, low: 4294967295 });

    const bigUnk = SequenceNumber.Unknown.asBigInt();
    expect(bigUnk).toEqual(-4294967296n);
    expect(SequenceNumber.fromBigInt(bigUnk)).toEqual({ high: -1, low: 0 });
  });
});
