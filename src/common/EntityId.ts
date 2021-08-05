import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { EntityKind } from "./enums";
import { uint32ToHex } from "./hex";

export type EntityId = number; // 32-bit unsigned integer

export enum EntityIdBuiltin {
  Unknown = 0,
  Participant = 0x0001c1, // makeEntityId(0x0001, EntityKind.BuiltinParticipant);
  PublicationsReader = 0x0003c7, // makeEntityId(0x0003, EntityKind.BuiltinReaderWithKey);
  PublicationsWriter = 0x0003c2, // makeEntityId(0x0003, EntityKind.BuiltinWriterWithKey);
  SubscriptionsReader = 0x0004c7, // makeEntityId(0x0004, EntityKind.BuiltinReaderWithKey);
  SubscriptionsWriter = 0x0004c2, // makeEntityId(0x0004, EntityKind.BuiltinWriterWithKey);
  ParticipantReader = 0x0100c7, // makeEntityId(0x0100, EntityKind.BuiltinReaderWithKey);
  ParticipantWriter = 0x0100c2, // makeEntityId(0x0100, EntityKind.BuiltinWriterWithKey);
  ParticipantMessageReader = 0x0200c7, // makeEntityId(0x0200, EntityKind.BuiltinReaderWithKey);
  ParticipantMessageWriter = 0x0200c2, // makeEntityId(0x0200, EntityKind.BuiltinWriterWithKey);
  TypeLookupRequestReader = 0x0300c4, // makeEntityId(0x0300, EntityKind.BuiltinReaderNoKey);
  TypeLookupRequestWriter = 0x0300c3, // makeEntityId(0x0300, EntityKind.BuiltinWriterNoKey);
  TypeLookupReplyReader = 0x0301c4, // makeEntityId(0x0301, EntityKind.BuiltinReaderNoKey);
  TypeLookupReplyWriter = 0x0301c3, // makeEntityId(0x0301, EntityKind.BuiltinWriterNoKey);
}

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
