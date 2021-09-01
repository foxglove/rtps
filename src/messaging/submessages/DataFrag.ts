import { Time } from "@foxglove/rostime";

import {
  EntityId,
  entityIdFromData,
  writeEntityId,
  GuidPrefix,
  LittleEndian,
  SubMessageId,
  SequenceNumber,
  sequenceNumberFromData,
  sequenceNumberToData,
} from "../../common";
import { SubMessage } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";

export class DataFrag implements SubMessage {
  constructor(
    public readerEntityId: EntityId,
    public writerEntityId: EntityId,
    public writerSeqNumber: SequenceNumber,
    public fragmentStartingNum: number,
    public fragmentsInSubmessage: number,
    public fragmentSize: number,
    public sampleSize: number,
    public fragments: Uint8Array[],
  ) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    const payloadLength = roundUpToMultipleOfFour(this.fragmentsInSubmessage * this.fragmentSize);
    const payloadOffset = output.byteOffset + offset + 36;

    const flags = littleEndian ? LittleEndian : 0;
    output.setUint8(offset, SubMessageId.DATA_FRAG);
    output.setUint8(offset + 1, flags); // flags
    output.setUint16(offset + 2, 32 + payloadLength, littleEndian); // octetsToNextHeader
    output.setUint16(offset + 4, 0, false); // Extra flags
    output.setUint16(offset + 6, 28, littleEndian); // octetsToInlineQoS
    writeEntityId(this.readerEntityId, output, offset + 8);
    writeEntityId(this.writerEntityId, output, offset + 12);
    sequenceNumberToData(this.writerSeqNumber, output, offset + 16, littleEndian);
    output.setUint32(offset + 24, this.fragmentStartingNum, littleEndian);
    output.setUint16(offset + 28, this.fragmentsInSubmessage, littleEndian);
    output.setUint16(offset + 30, this.fragmentSize, littleEndian);
    output.setUint32(offset + 32, this.sampleSize, littleEndian);

    const outputBytes = new Uint8Array(output.buffer, payloadOffset, payloadLength);
    for (let i = 0; i < this.fragments.length; i++) {
      outputBytes.set(this.fragments[i]!, i * this.fragmentSize);
    }

    return 36 + payloadLength;
  }
}

export class DataFragView extends SubMessageView {
  constructor(
    data: Uint8Array,
    view: DataView,
    offset: number,
    guidPrefix?: GuidPrefix,
    timestamp?: Time,
  ) {
    super(data, view, offset, guidPrefix, timestamp);

    if (offset + 4 + this.octetsToNextHeader > view.byteLength) {
      throw new Error(
        `DATA_FRAG message is truncated, offset=${offset}, octetsToNextHeader=${this.octetsToNextHeader}, length=${view.byteLength}`,
      );
    }

    const octetsToInlineQoS = view.getUint16(offset + 6, this.littleEndian);
    if (octetsToInlineQoS !== 28) {
      throw new Error(`unexpected octetsToInlineQoS, expected 28 got ${octetsToInlineQoS}`);
    }
  }

  get readerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 8);
  }

  get writerEntityId(): EntityId {
    return entityIdFromData(this.view, this.offset + 12);
  }

  get writerSeqNumber(): SequenceNumber {
    return sequenceNumberFromData(this.view, this.offset + 16, this.littleEndian);
  }

  get fragmentStartingNum(): number {
    return this.view.getUint32(this.offset + 24, this.littleEndian);
  }

  get fragmentsInSubmessage(): number {
    return this.view.getUint16(this.offset + 28, this.littleEndian);
  }

  get fragmentSize(): number {
    return this.view.getUint16(this.offset + 30, this.littleEndian);
  }

  get sampleSize(): number {
    return this.view.getUint32(this.offset + 32, this.littleEndian);
  }

  get fragments(): Uint8Array[] {
    const start = this.fragmentStartingNum;
    const size = this.fragmentSize;
    const count = this.fragmentsInSubmessage;
    const totalBytes = this.sampleSize;
    const fragments: Uint8Array[] = [];

    for (let i = 0; i < count; i++) {
      const fragmentOffset = this.offset + 36 + i * size;
      const endByte = (start + i) * size;
      const curSize = endByte > totalBytes ? size - (endByte % totalBytes) : size;
      const fragment = new Uint8Array(
        this.data.buffer,
        this.data.byteOffset + fragmentOffset,
        curSize,
      );
      fragments.push(fragment);
    }

    return fragments;
  }
}

function roundUpToMultipleOfFour(num: number): number {
  return num % 4 === 0 ? num : num + (4 - (num % 4));
}
