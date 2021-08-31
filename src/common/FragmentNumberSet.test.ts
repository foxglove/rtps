import { FragmentNumberSet } from "./FragmentNumberSet";

describe("FragmentNumberSet", () => {
  it("constructs empty", () => {
    const set = new FragmentNumberSet(1, 0);
    expect(set.base).toEqual(1);
    expect(set.numBits).toEqual(0);
    expect(set.size).toEqual(8);
    expect(set.empty()).toEqual(true);
    expect(set.maxFragmentNumber()).toEqual(0);
    expect(Array.from(set.fragmentNumbers())).toEqual([]);
    expect(set.bitmap).toEqual(new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0]));

    const set2 = new FragmentNumberSet(5, 0);
    expect(set2.maxFragmentNumber()).toEqual(4);
  });

  it("constructs with numBits", () => {
    const set = new FragmentNumberSet(2, 1);
    expect(set.base).toEqual(2);
    expect(set.numBits).toEqual(1);
    expect(set.size).toEqual(12);
    expect(set.empty()).toEqual(false);
    expect(set.maxFragmentNumber()).toEqual(2);
    expect(Array.from(set.fragmentNumbers())).toEqual([]);
    expect(set.bitmap).toEqual(new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0]));
  });

  it("constructs with numBits and bitmap", () => {
    const set = new FragmentNumberSet(3, 42, new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(set.base).toEqual(3);
    expect(set.numBits).toEqual(42);
    expect(set.size).toEqual(16);
    expect(set.empty()).toEqual(false);
    expect(set.maxFragmentNumber()).toEqual(44);
    expect(Array.from(set.fragmentNumbers())).toEqual([34]); // base 3 + 31st bit set
    expect(set.bitmap).toEqual(new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it("adds", () => {
    const set = new FragmentNumberSet(2, 3);
    expect(set.maxFragmentNumber()).toEqual(4);
    expect(Array.from(set.fragmentNumbers())).toEqual([]);
    expect(set.add(1)).toEqual(false);
    expect(set.add(4)).toEqual(true);
    expect(set.add(5)).toEqual(false);
    expect(set.add(6)).toEqual(false);
    expect(set.add(2)).toEqual(true);
    expect(set.maxFragmentNumber()).toEqual(4);
    expect(Array.from(set.fragmentNumbers())).toEqual([2, 4]);
    expect(set.bitmap).toEqual(new Uint32Array([2684354560, 0, 0, 0, 0, 0, 0, 0]));
  });

  it("write / fromData", () => {
    const set = new FragmentNumberSet(2, 3);
    expect(set.add(4)).toEqual(true);
    expect(set.add(2)).toEqual(true);

    const buffer = new ArrayBuffer(set.size);
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);
    set.write(view, 0, true);
    expect(data).toEqual(new Uint8Array([
      2, 0, 0, 0,
      3, 0, 0, 0,
      0, 0, 0, 160,
    ])); // prettier-ignore

    const set2 = FragmentNumberSet.fromData(view, 0, true);
    expect(set.base).toEqual(set2.base);
    expect(set.numBits).toEqual(set2.numBits);
    expect(set.bitmap).toEqual(set2.bitmap);
    expect(Array.from(set2.fragmentNumbers())).toEqual([2, 4]);
  });
});
