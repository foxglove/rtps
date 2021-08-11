import { Time } from "@foxglove/rostime";

import { GuidPrefix, LittleEndian, SubMessageId } from "../common";

export class SubMessageView {
  readonly data: Readonly<Uint8Array>;
  readonly view: Readonly<DataView>;
  readonly offset: number;
  readonly littleEndian: boolean;
  readonly octetsToNextHeader: number;
  readonly effectiveGuidPrefix?: GuidPrefix;
  readonly effectiveTimestamp?: Time;

  constructor(
    data: Uint8Array,
    view: DataView,
    offset: number,
    guidPrefix?: GuidPrefix,
    timestamp?: Time,
  ) {
    this.data = data;
    this.view = view;
    this.offset = offset;
    this.littleEndian = (this.flags & LittleEndian) === LittleEndian;
    this.octetsToNextHeader = this.view.getUint16(this.offset + 2, this.littleEndian);
    this.effectiveGuidPrefix = guidPrefix;
    this.effectiveTimestamp = timestamp;
  }

  get submessageId(): SubMessageId {
    return this.view.getUint8(this.offset);
  }

  get flags(): number {
    return this.view.getUint8(this.offset + 1);
  }
}
