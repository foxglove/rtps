import {
  EntityId,
  entityIdFromData,
  writeEntityId,
  LittleEndian,
  SubMessageId,
  SequenceNumber,
  FragmentNumberSet,
  sequenceNumberToData,
  sequenceNumberFromData,
} from "../../common";
import { SubMessage } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";

export class NackFrag implements SubMessage {
  constructor(
    public readerEntityId: EntityId,
    public writerEntityId: EntityId,
    public writerSeqNumber: SequenceNumber,
    public fragmentNumberState: FragmentNumberSet,
    public count: number,
  ) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    const flags = littleEndian ? LittleEndian : 0;
    const fragmentSetSize = this.fragmentNumberState.size;
    output.setUint8(offset, SubMessageId.NACK_FRAG);
    output.setUint8(offset + 1, flags); // flags
    output.setUint16(offset + 2, 20 + fragmentSetSize, littleEndian); // octetsToNextHeader
    writeEntityId(this.readerEntityId, output, offset + 4);
    writeEntityId(this.writerEntityId, output, offset + 8);
    sequenceNumberToData(this.writerSeqNumber, output, offset + 12, littleEndian);
    this.fragmentNumberState.write(output, offset + 20, littleEndian);
    output.setUint32(offset + 20 + fragmentSetSize, this.count, littleEndian);
    return 20 + fragmentSetSize + 4;
  }
}

export class NackFragView extends SubMessageView {
  get readerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 4);
  }

  get writerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 8);
  }

  get writerSeqNumber(): SequenceNumber {
    return sequenceNumberFromData(this.view, this.offset + 12, this.littleEndian);
  }

  get fragmentNumberState(): FragmentNumberSet {
    return FragmentNumberSet.fromData(this.view, this.offset + 20, this.littleEndian);
  }

  get count(): number {
    const numBits = this.view.getUint32(this.offset + 20 + 4, this.littleEndian);
    const numLongs = Math.floor((numBits + 31) / 32);
    const offset = this.offset + 20 + 4 + 4 + numLongs * 4;
    return this.view.getUint32(offset, this.littleEndian);
  }
}
