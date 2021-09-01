import { FragmentNumberSet, fromHex, toHex } from "../../common";
import { NackFrag, NackFragView } from "./NackFrag";

const TEST_DATA =
  "12012400000000290000002a00000000650000002b0000002c000000000000a0000000802e000000";

describe("NackFrag", () => {
  it("serializes", () => {
    const fragmentNumberState = new FragmentNumberSet(43, 44);
    fragmentNumberState.add(43);
    fragmentNumberState.add(45);
    fragmentNumberState.add(75);

    const nackFrag = new NackFrag(41, 42, 101n, fragmentNumberState, 46);
    const bytes = new Uint8Array(40);
    const output = new DataView(bytes.buffer);

    expect(nackFrag.write(output, 0, true)).toEqual(40);
    expect(toHex(bytes)).toEqual(TEST_DATA);
  });
});

describe("NackFragView", () => {
  it("deserializes", () => {
    const bytes = fromHex(TEST_DATA);
    const view = new DataView(bytes.buffer);
    const frag = new NackFragView(bytes, view, 0);

    expect(frag.readerEntityId).toEqual(41);
    expect(frag.writerEntityId).toEqual(42);
    expect(frag.writerSeqNumber).toEqual(101n);
    expect(frag.fragmentNumberState.base).toEqual(43);
    expect(frag.fragmentNumberState.numBits).toEqual(44);
    expect(frag.fragmentNumberState.size).toEqual(16);
    expect(frag.fragmentNumberState.bitmap).toEqual(
      new Uint32Array([2684354560, 2147483648, 0, 0, 0, 0, 0, 0]),
    );
    expect(frag.count).toEqual(46);
  });
});
