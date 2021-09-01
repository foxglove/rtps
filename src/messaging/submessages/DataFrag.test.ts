import { fromHex, toHex } from "../../common";
import { DataFrag, DataFragView } from "./DataFrag";

const TEST_DATA =
  "1601300000001c00000000290000002a000000002b00000001000000030005000d0000000102030405060708090a0b0c0d000000";

describe("DataFrag", () => {
  it("serializes", () => {
    const frag = new DataFrag(41, 42, 43n, 1, 3, 5, 13, [
      new Uint8Array([1, 2, 3, 4, 5]),
      new Uint8Array([6, 7, 8, 9, 10]),
      new Uint8Array([11, 12, 13]),
    ]);

    const bytes = new Uint8Array(52);
    const output = new DataView(bytes.buffer);

    expect(frag.write(output, 0, true)).toEqual(52);
    expect(toHex(bytes)).toEqual(TEST_DATA);
  });
});

describe("DataFragView", () => {
  it("deserializes", () => {
    const bytes = fromHex(TEST_DATA);
    const view = new DataView(bytes.buffer);
    const frag = new DataFragView(bytes, view, 0);

    expect(frag.readerEntityId).toEqual(41);
    expect(frag.writerEntityId).toEqual(42);
    expect(frag.writerSeqNumber).toEqual(43n);
    expect(frag.fragmentStartingNum).toEqual(1);
    expect(frag.fragmentsInSubmessage).toEqual(3);
    expect(frag.fragmentSize).toEqual(5);
    expect(frag.sampleSize).toEqual(13);
    expect(frag.fragments).toEqual([
      new Uint8Array([1, 2, 3, 4, 5]),
      new Uint8Array([6, 7, 8, 9, 10]),
      new Uint8Array([11, 12, 13]),
    ]);
  });
});
