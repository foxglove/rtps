import { fromHex, SequenceNumberSet, toHex } from "../../common";
import { AckNack, AckNackFlags, AckNackView } from "./AckNack";

const TEST_DATA = "06032000000000290000002a000000002b0000002c000000000000a0000000802e000000";

describe("AckNack", () => {
  it("serializes", () => {
    const readerSNState = new SequenceNumberSet(43n, 44);
    readerSNState.add(43n);
    readerSNState.add(45n);
    readerSNState.add(75n);

    const ackNack = new AckNack(41, 42, readerSNState, 46, AckNackFlags.Final);
    const bytes = new Uint8Array(36);
    const output = new DataView(bytes.buffer);

    expect(ackNack.write(output, 0, true)).toEqual(36);
    expect(toHex(bytes)).toEqual(TEST_DATA);
  });
});

describe("AckNackView", () => {
  it("deserializes", () => {
    const bytes = fromHex(TEST_DATA);
    const view = new DataView(bytes.buffer);
    const frag = new AckNackView(bytes, view, 0);

    expect(frag.readerEntityId).toEqual(41);
    expect(frag.writerEntityId).toEqual(42);
    expect(frag.readerSNState.base).toEqual(43n);
    expect(frag.readerSNState.numBits).toEqual(44);
    expect(frag.readerSNState.size).toEqual(20);
    expect(frag.readerSNState.bitmap).toEqual(
      new Uint32Array([2684354560, 2147483648, 0, 0, 0, 0, 0, 0]),
    );
    expect(frag.count).toEqual(46);
  });
});
