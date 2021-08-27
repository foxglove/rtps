import { SequenceNumberSet } from "./SequenceNumberSet";

describe("SequenceNumberSet", () => {
  it("constructs empty", () => {
    const set = new SequenceNumberSet(1n, 0);
    expect(set.base).toEqual(1n);
    expect(set.numBits).toEqual(0);
    expect(set.size).toEqual(12);
    expect(set.empty()).toEqual(true);
    expect(set.maxSequenceNumber()).toEqual(0n);
    expect(Array.from(set.sequenceNumbers())).toEqual([]);
    expect(set.bitmap).toEqual(new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0]));

    const set2 = new SequenceNumberSet(5n, 0);
    expect(set2.maxSequenceNumber()).toEqual(4n);
  });

  it("constructs with numBits", () => {
    const set = new SequenceNumberSet(2n, 1);
    expect(set.base).toEqual(2n);
    expect(set.numBits).toEqual(1);
    expect(set.size).toEqual(16);
    expect(set.empty()).toEqual(false);
    expect(set.maxSequenceNumber()).toEqual(2n);
    expect(Array.from(set.sequenceNumbers())).toEqual([]);
    expect(set.bitmap).toEqual(new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0]));
  });

  it("constructs with numBits and bitmap", () => {
    const set = new SequenceNumberSet(3n, 42, new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(set.base).toEqual(3n);
    expect(set.numBits).toEqual(42);
    expect(set.size).toEqual(20);
    expect(set.empty()).toEqual(false);
    expect(set.maxSequenceNumber()).toEqual(44n);
    expect(Array.from(set.sequenceNumbers())).toEqual([34n]); // base 3 + 31st bit set
    expect(set.bitmap).toEqual(new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it("adds", () => {
    const set = new SequenceNumberSet(2n, 3);
    expect(set.maxSequenceNumber()).toEqual(4n);
    expect(Array.from(set.sequenceNumbers())).toEqual([]);
    expect(set.add(1n)).toEqual(false);
    expect(set.add(4n)).toEqual(true);
    expect(set.add(5n)).toEqual(false);
    expect(set.add(6n)).toEqual(false);
    expect(set.add(2n)).toEqual(true);
    expect(set.maxSequenceNumber()).toEqual(4n);
    expect(Array.from(set.sequenceNumbers())).toEqual([2n, 4n]);
    expect(set.bitmap).toEqual(new Uint32Array([2684354560, 0, 0, 0, 0, 0, 0, 0]));
  });

  it("write / fromData", () => {
    const set = new SequenceNumberSet(2n, 3);
    expect(set.add(4n)).toEqual(true);
    expect(set.add(2n)).toEqual(true);

    const buffer = new ArrayBuffer(set.size);
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);
    set.write(view, 0, true);
    expect(data).toEqual(new Uint8Array([
      0, 0, 0, 0,
      2, 0, 0, 0,
      3, 0, 0, 0,
      0, 0, 0, 160,
    ])); // prettier-ignore

    const set2 = SequenceNumberSet.fromData(view, 0, true);
    expect(set.base).toEqual(set2.base);
    expect(set.numBits).toEqual(set2.numBits);
    expect(set.bitmap).toEqual(set2.bitmap);
    expect(Array.from(set2.sequenceNumbers())).toEqual([2n, 4n]);
  });
});
