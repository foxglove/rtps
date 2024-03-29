import {
  EntityId,
  entityIdFromData,
  writeEntityId,
  SequenceNumber,
  sequenceNumberFromData,
  sequenceNumberToData,
  LittleEndian,
  SubMessageId,
} from "../../common";
import { SubMessage } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";

export enum HeartbeatFlags {
  Final = 1 << 1,
  Liveliness = 1 << 2,
}

export class Heartbeat implements SubMessage {
  constructor(
    public readerEntityId: EntityId,
    public writerEntityId: EntityId,
    public firstAvailableSeqNumber: SequenceNumber,
    public lastSeqNumber: SequenceNumber,
    public count: number,
    public flags: HeartbeatFlags,
  ) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    const flags = (littleEndian ? LittleEndian : 0) | this.flags;
    output.setUint8(offset, SubMessageId.HEARTBEAT);
    output.setUint8(offset + 1, flags); // flags
    output.setUint16(offset + 2, 28, littleEndian); // octetsToNextHeader
    writeEntityId(this.readerEntityId, output, offset + 4);
    writeEntityId(this.writerEntityId, output, offset + 8);
    sequenceNumberToData(this.firstAvailableSeqNumber, output, offset + 12, littleEndian);
    sequenceNumberToData(this.lastSeqNumber, output, offset + 20, littleEndian);
    output.setUint32(offset + 28, this.count, littleEndian);
    return 32;
  }

  static size(): number {
    return 32;
  }
}

export class HeartbeatView extends SubMessageView {
  get final(): boolean {
    return (this.view.getUint8(this.offset + 1) & HeartbeatFlags.Final) === HeartbeatFlags.Final;
  }

  get liveliness(): boolean {
    return (
      (this.view.getUint8(this.offset + 1) & HeartbeatFlags.Liveliness) ===
      HeartbeatFlags.Liveliness
    );
  }

  get readerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 4);
  }

  get writerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 8);
  }

  get firstAvailableSeqNumber(): SequenceNumber {
    return sequenceNumberFromData(this.view, this.offset + 12, this.littleEndian);
  }

  get lastSeqNumber(): SequenceNumber {
    return sequenceNumberFromData(this.view, this.offset + 20, this.littleEndian);
  }

  get count(): number {
    return this.view.getUint32(this.offset + 28, this.littleEndian);
  }
}
