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

export class HeartbeatFrag implements SubMessage {
  constructor(
    public readerEntityId: EntityId,
    public writerEntityId: EntityId,
    public writerSeqNumber: SequenceNumber,
    public lastFragmentNumber: number,
    public count: number,
  ) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    const flags = littleEndian ? LittleEndian : 0;
    output.setUint8(offset, SubMessageId.HEARTBEAT_FRAG);
    output.setUint8(offset + 1, flags); // flags
    output.setUint16(offset + 2, 24, littleEndian); // octetsToNextHeader
    writeEntityId(this.readerEntityId, output, offset + 4);
    writeEntityId(this.writerEntityId, output, offset + 8);
    sequenceNumberToData(this.writerSeqNumber, output, offset + 12, littleEndian);
    output.setUint32(offset + 20, this.lastFragmentNumber, littleEndian);
    output.setUint32(offset + 24, this.count, littleEndian);
    return 28;
  }
}

export class HeartbeatFragView extends SubMessageView {
  get readerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 4);
  }

  get writerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 8);
  }

  get writerSeqNumber(): SequenceNumber {
    return sequenceNumberFromData(this.view, this.offset + 12, this.littleEndian);
  }

  get lastFragmentNumber(): number {
    return this.view.getUint32(this.offset + 20, this.littleEndian);
  }

  get count(): number {
    return this.view.getUint32(this.offset + 24, this.littleEndian);
  }
}
