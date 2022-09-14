import { GuidPrefix, writeGuidPrefix, VendorId, ProtocolVersion } from "../common";
import { SubMessageGroup } from "./SubMessageGroup";

export type MessageOptions = {
  guidPrefix: GuidPrefix;
  bigEndian?: boolean;
  protocolVersion: ProtocolVersion;
  vendorId: VendorId;
  maxSize?: number;
};

export class Message {
  private buffer: ArrayBuffer;
  private array: Uint8Array;
  private view: DataView;
  private offset: number;

  get data(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  get size(): number {
    return this.offset;
  }

  constructor(opts: MessageOptions) {
    this.buffer = new ArrayBuffer(opts.maxSize ?? 1500);
    this.array = new Uint8Array(this.buffer, 0, this.buffer.byteLength);
    this.view = new DataView(this.buffer);

    const protocolVersion = opts.protocolVersion;
    const vendorId = opts.vendorId;

    this.view.setUint32(0, 0x52545053, false); // RTPS
    this.view.setUint8(4, protocolVersion.major);
    this.view.setUint8(5, protocolVersion.minor);
    this.view.setUint16(6, vendorId, false);
    writeGuidPrefix(opts.guidPrefix, this.view, 8);
    this.offset = 20;
  }

  writeGroup(group: SubMessageGroup): void {
    const data = group.data;
    if (this.offset + data.byteLength > this.buffer.byteLength) {
      throw new Error(
        `Message buffer overflow: ${this.offset} + ${data.byteLength} > ${this.buffer.byteLength}`,
      );
    }
    this.array.set(data, this.offset);
    this.offset += data.byteLength;
  }
}
