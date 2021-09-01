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

export enum DataFlags {
  InlineQoS = 1 << 1,
  DataPresent = 1 << 2,
  SerializedKey = 1 << 3,
}

export class DataMsg implements SubMessage {
  constructor(
    public readerEntityId: EntityId,
    public writerEntityId: EntityId,
    public writerSeqNumber: SequenceNumber,
    public serializedData: Uint8Array,
    public flags: DataFlags,
  ) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    const payloadLength = this.serializedData.byteLength;
    const payloadOffset = output.byteOffset + offset + 24;

    const flags = (littleEndian ? LittleEndian : 0) | this.flags;
    output.setUint8(offset, SubMessageId.DATA);
    output.setUint8(offset + 1, flags); // flags
    output.setUint16(offset + 2, 20 + payloadLength, littleEndian); // octetsToNextHeader
    output.setUint16(offset + 4, 0, false); // Extra flags
    output.setUint16(offset + 6, 16, littleEndian); // octetsToInlineQoS
    writeEntityId(this.readerEntityId, output, offset + 8);
    writeEntityId(this.writerEntityId, output, offset + 12);
    sequenceNumberToData(this.writerSeqNumber, output, offset + 16, littleEndian);

    new Uint8Array(output.buffer, payloadOffset, payloadLength).set(this.serializedData);
    return 24 + payloadLength;
  }
}

export class DataMsgView extends SubMessageView {
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
        `DATA message is truncated, offset=${offset}, octetsToNextHeader=${this.octetsToNextHeader}, length=${view.byteLength}`,
      );
    }

    const octetsToInlineQoS = view.getUint16(offset + 6, this.littleEndian);
    if (octetsToInlineQoS !== 16) {
      throw new Error(`unexpected octetsToInlineQoS, expected 16 got ${octetsToInlineQoS}`);
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

  get serializedData(): Uint8Array {
    const payloadLength = this.octetsToNextHeader - 24;
    return new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset + 24, payloadLength);
  }
}
