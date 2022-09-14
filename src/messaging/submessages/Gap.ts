import {
  EntityId,
  entityIdFromData,
  writeEntityId,
  SequenceNumber,
  sequenceNumberFromData,
  sequenceNumberToData,
  LittleEndian,
  SubMessageId,
  SequenceNumberSet,
} from "../../common";
import { SubMessage } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";

export class Gap implements SubMessage {
  constructor(
    public readerEntityId: EntityId,
    public writerEntityId: EntityId,
    public gapStart: SequenceNumber,
    public gapList: SequenceNumberSet,
  ) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    const flags = littleEndian ? LittleEndian : 0;
    const gapListSize = this.gapList.size;
    output.setUint8(offset, SubMessageId.GAP);
    output.setUint8(offset + 1, flags); // flags
    output.setUint16(offset + 2, 16 + gapListSize, littleEndian); // octetsToNextHeader
    writeEntityId(this.readerEntityId, output, offset + 4);
    writeEntityId(this.writerEntityId, output, offset + 8);
    sequenceNumberToData(this.gapStart, output, offset + 12, littleEndian);
    this.gapList.write(output, offset + 20, littleEndian);
    return 20 + gapListSize;
  }

  static size(gapListSize: number): number {
    return 20 + gapListSize;
  }
}

export class GapView extends SubMessageView {
  get readerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 4);
  }

  get writerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 8);
  }

  get gapStart(): SequenceNumber {
    return sequenceNumberFromData(this.view, this.offset + 12, this.littleEndian);
  }

  get gapList(): SequenceNumberSet {
    return SequenceNumberSet.fromData(this.view, this.offset + 20, this.littleEndian);
  }
}
