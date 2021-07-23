import { EntityId } from "../EntityId";
import { SequenceNumberSet } from "../SequenceNumberSet";
import { SubMessage } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";
import { LittleEndian, SubMessageId } from "../enums";

export const Final = 1 << 1;

export class AckNack implements SubMessage {
  constructor(
    public readerEntityId: EntityId,
    public writerEntityId: EntityId,
    public readerSNState: SequenceNumberSet,
    public count: number,
    public final: boolean,
  ) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    let flags = littleEndian ? LittleEndian : 0;
    flags |= this.final ? Final : 0;
    output.setUint8(offset, SubMessageId.ACKNACK);
    output.setUint8(offset + 1, flags); // flags
    output.setUint16(offset + 2, 28, littleEndian); // octetsToNextHeader
    this.readerEntityId.write(output, offset + 4);
    this.writerEntityId.write(output, offset + 8);
    this.readerSNState.write(output, offset + 12, littleEndian);
    output.setUint32(offset + 28, this.count, littleEndian);
    return 32;
  }
}

export class AckNackView extends SubMessageView {
  get final(): boolean {
    return (this.view.getUint8(this.offset + 1) & Final) === Final;
  }

  get readerEntityId(): EntityId {
    return EntityId.fromData(this.view, this.offset + 4);
  }

  get writerEntityId(): EntityId {
    return EntityId.fromData(this.view, this.offset + 8);
  }

  get readerSNState(): SequenceNumberSet {
    return SequenceNumberSet.fromData(this.view, this.offset + 12, this.littleEndian);
  }

  get count(): number {
    return this.view.getUint32(this.offset + 28, this.littleEndian);
  }
}
