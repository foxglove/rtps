import { EntityId } from "../EntityId";
import { LittleEndian, SubMessage, SubMessageId } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";
import { Final } from "./AckNack";

export const Liveliness = 1 << 2;

export class Heartbeat implements SubMessage {
  constructor(
    public readerEntityId: EntityId,
    public writerEntityId: EntityId,
    public firstAvailableSeqNumber: bigint,
    public lastSeqNumber: bigint,
    public count: number,
    public final: boolean,
    public liveliness: boolean,
  ) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    let flags = littleEndian ? LittleEndian : 0;
    flags |= this.final ? Final : 0;
    flags |= this.liveliness ? Liveliness : 0;
    output.setUint8(offset, SubMessageId.HEARTBEAT);
    output.setUint8(offset + 1, flags); // flags
    output.setUint16(offset + 2, 28, littleEndian); // octetsToNextHeader
    this.readerEntityId.write(output, offset + 4);
    this.writerEntityId.write(output, offset + 8);
    output.setBigUint64(offset + 12, this.firstAvailableSeqNumber, littleEndian);
    output.setBigUint64(offset + 20, this.lastSeqNumber, littleEndian);
    output.setUint32(offset + 28, this.count, littleEndian);
    return 32;
  }
}

export class HeartbeatView extends SubMessageView {
  get final(): boolean {
    return (this.view.getUint8(this.offset + 1) & Final) === Final;
  }

  get liveliness(): boolean {
    return (this.view.getUint8(this.offset + 1) & Liveliness) === Liveliness;
  }

  get readerEntityId(): EntityId {
    return EntityId.fromData(this.view, this.offset + 4);
  }

  get writerEntityId(): EntityId {
    return EntityId.fromData(this.view, this.offset + 8);
  }

  get firstAvailableSeqNumber(): bigint {
    return this.view.getBigUint64(this.offset + 12, this.littleEndian);
  }

  get lastSeqNumber(): bigint {
    return this.view.getBigUint64(this.offset + 20, this.littleEndian);
  }

  get count(): number {
    return this.view.getUint32(this.offset + 28, this.littleEndian);
  }
}
