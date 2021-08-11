import { GuidPrefix, writeGuidPrefix, VendorId, ProtocolVersion } from "../common";
import { SubMessage } from "./SubMessage";

export type MessageOptions = {
  guidPrefix: GuidPrefix;
  bigEndian?: boolean;
  protocolVersion: ProtocolVersion;
  vendorId: VendorId;
  maxSize?: number;
};

export class Message {
  private littleEndian: boolean;
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;

  get data(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  get size(): number {
    return this.offset;
  }

  constructor(opts: MessageOptions) {
    this.littleEndian = !(opts.bigEndian === true);
    this.buffer = new ArrayBuffer(opts.maxSize ?? 1500);
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

  writeSubmessage(msg: SubMessage): void {
    this.offset += msg.write(this.view, this.offset, this.littleEndian);
  }
}
