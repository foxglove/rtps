import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { EntityKind } from "./enums";
import { uint32ToHex } from "./toHex";

export type EntityId = number; // 32-bit unsigned integer

export const EntityIdParticipant = 0x0001c1; // makeEntityId(0x0001, EntityKind.BuiltinParticipant);
export const EntityIdBuiltinPublicationsReader = 0x0003c7; // makeEntityId(0x0003, EntityKind.BuiltinReaderWithKey); // prettier-ignore
export const EntityIdBuiltinPublicationsWriter = 0x0003c2; // makeEntityId(0x0003, EntityKind.BuiltinWriterWithKey); // prettier-ignore
export const EntityIdBuiltinSubscriptionsReader = 0x0004c7; // makeEntityId(0x0004, EntityKind.BuiltinReaderWithKey); // prettier-ignore
export const EntityIdBuiltinSubscriptionsWriter = 0x0004c2; // makeEntityId(0x0004, EntityKind.BuiltinWriterWithKey); // prettier-ignore
export const EntityIdBuiltinParticipantReader = 0x0100c7; // makeEntityId(0x0100, EntityKind.BuiltinReaderWithKey); // prettier-ignore
export const EntityIdBuiltinParticipantWriter = 0x0100c2; // makeEntityId(0x0100, EntityKind.BuiltinWriterWithKey); // prettier-ignore
export const EntityIdBuiltinParticipantMessageReader = 0x0200c7; // makeEntityId(0x0200, EntityKind.BuiltinReaderWithKey); // prettier-ignore
export const EntityIdBuiltinParticipantMessageWriter = 0x0200c2; // makeEntityId(0x0200, EntityKind.BuiltinWriterWithKey); // prettier-ignore
export const EntityIdBuiltinTypeLookupRequestReader = 0x0300c4; // makeEntityId(0x0300, EntityKind.BuiltinReaderNoKey); // prettier-ignore
export const EntityIdBuiltinTypeLookupRequestWriter = 0x0300c3; // makeEntityId(0x0300, EntityKind.BuiltinWriterNoKey); // prettier-ignore
export const EntityIdBuiltinTypeLookupReplyReader = 0x0301c4; // makeEntityId(0x0301, EntityKind.BuiltinReaderNoKey); // prettier-ignore
export const EntityIdBuiltinTypeLookupReplyWriter = 0x0301c3; // makeEntityId(0x0301, EntityKind.BuiltinWriterNoKey); // prettier-ignore

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
