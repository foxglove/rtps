import { CdrReader, CdrWriter } from "@foxglove/cdr";

import {
  entityIdFromCDR,
  entityIdFromData,
  entityIdFromString,
  makeEntityId,
  writeEntityId,
  writeEntityIdToCDR,
} from "./EntityId";
import { EntityKind } from "./enums";

describe("EntityId", () => {
  it("makeEntityId", () => {
    expect(makeEntityId(0, EntityKind.AppdefUnknown)).toEqual(0);
    expect(makeEntityId(0, EntityKind.AppdefParticipant)).toEqual(1);
    expect(makeEntityId(1, EntityKind.AppdefUnknown)).toEqual(0x000100);
    expect(makeEntityId(0xabcdef, 0x12)).toEqual(0xabcdef12);
  });

  it("entityIdFromString", () => {
    expect(entityIdFromString("00000000")).toEqual(0);
    expect(entityIdFromString("00000001")).toEqual(1);
    expect(entityIdFromString("abcdef12")).toEqual(0xabcdef12);
  });

  it("entityIdFromData", () => {
    const data = new Uint8Array(5);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    expect(entityIdFromData(view, 1)).toEqual(0);
    data.set([0x42, 0xab, 0xcd, 0xef, 0x12]);
    expect(entityIdFromData(view, 1)).toEqual(0xabcdef12);
  });

  it("entityIdFromCDR", () => {
    // little endian
    const data = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0xab, 0xcd, 0xef, 0x12]);
    let reader = new CdrReader(data);
    expect(entityIdFromCDR(reader)).toEqual(0xabcdef12);
    // big endian
    data.set([0x00, 0x00, 0x00, 0x00, 0xab, 0xcd, 0xef, 0x12]);
    reader = new CdrReader(data);
    expect(entityIdFromCDR(reader)).toEqual(0xabcdef12);
  });

  it("writeEntityId", () => {
    const data = new Uint8Array(5);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    data[0] = 0x42;
    writeEntityId(0xabcdef12, view, 1);
    expect(Array.from(data.values())).toEqual([0x42, 0xab, 0xcd, 0xef, 0x12]);
  });

  it("writeEntityIdToCDR", () => {
    const writer = new CdrWriter();
    writeEntityIdToCDR(0xabcdef12, writer);
    expect(Array.from(writer.data.values())).toEqual([
      0x00, 0x01, 0x00, 0x00, 0xab, 0xcd, 0xef, 0x12,
    ]);
  });
});
