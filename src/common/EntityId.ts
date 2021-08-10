import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { EntityKind } from "./enums";
import { uint32ToHex } from "./hex";

export type EntityId = number; // 32-bit unsigned integer

export function makeEntityId(key: number, kind: EntityKind): EntityId {
  return ((key << 8) | kind) >>> 0;
}

export function entityIdFromString(value: string): EntityId {
  return parseInt(value, 16);
}

export function entityIdFromData(view: DataView, offset: number): EntityId {
  return view.getUint32(offset, false);
}

export function entityIdFromCDR(reader: CdrReader): EntityId {
  return reader.uint32BE();
}

export function writeEntityId(id: EntityId, output: DataView, offset: number): void {
  output.setUint32(offset, id, false);
}

export function writeEntityIdToCDR(id: EntityId, output: CdrWriter): void {
  output.uint32BE(id);
}

export function entityIdToString(id: EntityId): string {
  return uint32ToHex(id);
}
