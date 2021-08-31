import {
  EntityId,
  entityIdFromData,
  writeEntityId,
  SequenceNumberSet,
  LittleEndian,
  SubMessageId,
} from "../../common";
import { SubMessage } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";

export enum AckNackFlags {
  Final = 1 << 1,
}

export class AckNack implements SubMessage {
  constructor(
    public readerEntityId: EntityId,
    public writerEntityId: EntityId,
    public readerSNState: SequenceNumberSet,
    public count: number,
    public flags: AckNackFlags,
  ) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    const flags = (littleEndian ? LittleEndian : 0) | this.flags;
    const sequenceSetSize = this.readerSNState.size;
    output.setUint8(offset, SubMessageId.ACKNACK);
    output.setUint8(offset + 1, flags); // flags
    output.setUint16(offset + 2, 12 + sequenceSetSize, littleEndian); // octetsToNextHeader
    writeEntityId(this.readerEntityId, output, offset + 4);
    writeEntityId(this.writerEntityId, output, offset + 8);
    this.readerSNState.write(output, offset + 12, littleEndian);
    output.setUint32(offset + 12 + sequenceSetSize, this.count, littleEndian);
    return 12 + sequenceSetSize + 4;
  }
}

export class AckNackView extends SubMessageView {
  get final(): boolean {
    return (this.view.getUint8(this.offset + 1) & AckNackFlags.Final) === AckNackFlags.Final;
  }

  get readerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 4);
  }

  get writerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 8);
  }

  get readerSNState(): SequenceNumberSet {
    return SequenceNumberSet.fromData(this.view, this.offset + 12, this.littleEndian);
  }

  get count(): number {
    const numBits = this.view.getUint32(this.offset + 12 + 8, this.littleEndian);
    const numLongs = Math.floor((numBits + 31) / 32);
    const offset = this.offset + 12 + 8 + 4 + numLongs * 4;
    return this.view.getUint32(offset, this.littleEndian);
  }
}
