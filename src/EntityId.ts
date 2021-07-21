import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { EntityKind } from "./enums";

export class EntityId {
  static Participant = new EntityId(1, EntityKind.BuiltinParticipant);
  static BuiltinParticipantReader = new EntityId(0x0100, EntityKind.BuiltinReaderWithKey);
  static BuiltinParticipantWriter = new EntityId(0x0100, EntityKind.BuiltinWriterWithKey);

  constructor(public key: number, public kind: EntityKind) {}

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

  static fromData(view: DataView, offset: number): EntityId {
    return new EntityId(view.getUint32(offset, false) >> 8, view.getUint8(offset + 3));
  }

  static fromCDR(reader: CdrReader): EntityId {
    const a = reader.uint8();
    const b = reader.uint8();
    const c = reader.uint8();
    return new EntityId((a << 16) | (b << 8) | c, reader.uint8());
  }
}
