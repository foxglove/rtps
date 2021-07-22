import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { EntityKind } from "./enums";
import { uint32ToHex } from "./toHex";

export class EntityId {
  static Participant = new EntityId(1, EntityKind.BuiltinParticipant);
  static BuiltinPublicationsReader = new EntityId(0x0003, EntityKind.BuiltinReaderWithKey);
  static BuiltinPublicationsWriter = new EntityId(0x0003, EntityKind.BuiltinWriterWithKey);
  static BuiltinSubscriptionsReader = new EntityId(0x0004, EntityKind.BuiltinReaderWithKey);
  static BuiltinSubscriptionsWriter = new EntityId(0x0004, EntityKind.BuiltinWriterWithKey);
  static BuiltinParticipantReader = new EntityId(0x0100, EntityKind.BuiltinReaderWithKey);
  static BuiltinParticipantWriter = new EntityId(0x0100, EntityKind.BuiltinWriterWithKey);
  static BuiltinParticipantMessageReader = new EntityId(0x0200, EntityKind.BuiltinReaderWithKey);
  static BuiltinParticipantMessageWriter = new EntityId(0x0200, EntityKind.BuiltinWriterWithKey);

  constructor(public key: number, public kind: EntityKind) {}

  get value(): number {
    return (this.key << 8) | this.kind;
  }

  equals(other: EntityId): boolean {
    return this.key === other.key && this.kind === other.kind;
  }

  write(output: DataView, offset: number): void {
    output.setUint8(offset, (this.key & 0x00ff0000) >> 16);
    output.setUint8(offset + 1, (this.key & 0x0000ff00) >> 8);
    output.setUint8(offset + 2, this.key & 0x000000ff);
    output.setUint8(offset + 3, this.kind);
  }

  toCDR(writer: CdrWriter): void {
    writer.uint8((this.key & 0x00ff0000) >> 16);
    writer.uint8((this.key & 0x0000ff00) >> 8);
    writer.uint8(this.key & 0x000000ff);
    writer.uint8(this.kind);
  }

  toString(): string {
    return uint32ToHex(this.value);
  }

  static fromData(view: DataView, offset: number): EntityId {
    return new EntityId(view.getUint32(offset, false) >> 8, view.getUint8(offset + 3));
  }

  static fromCDR(reader: CdrReader): EntityId {
    const a = reader.uint8();
    const b = reader.uint8();
    const c = reader.uint8();
    return new EntityId((a << 16) | (b << 8) | c, reader.uint8());
  }

  static fromValue(value: number): EntityId {
    return new EntityId(value >> 8, value & 0x000000ff);
  }
}
