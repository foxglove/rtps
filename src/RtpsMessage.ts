import { GuidPrefix } from "./GuidPrefix";
import { SubMessage } from "./SubMessage";
import { VendorId } from "./enums";
import { ProtocolVersion } from "./types";

export type RtpsMessageOptions = {
  guidPrefix: GuidPrefix;
  bigEndian?: boolean;
  protocolVersion?: ProtocolVersion;
  vendorId?: VendorId;
  maxSize?: number;
};

export class RtpsMessage {
  private littleEndian: boolean;
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;

  get data(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  constructor(opts: RtpsMessageOptions) {
    this.littleEndian = !(opts.bigEndian === true);
    this.buffer = new ArrayBuffer(opts.maxSize ?? 1500);
    this.view = new DataView(this.buffer);

    const protocolVersion = opts.protocolVersion ?? { major: 2, minor: 1 };
    const vendorId = opts.vendorId ?? VendorId.EclipseCycloneDDS;

    this.view.setUint32(0, 0x52545053, false); // RTPS
    this.view.setUint8(4, protocolVersion.major);
    this.view.setUint8(5, protocolVersion.minor);
    this.view.setUint16(6, vendorId, false);
    opts.guidPrefix.write(this.view, 8);
    this.offset = 20;
  }

  writeSubmessage(msg: SubMessage): void {
    this.offset += msg.write(this.view, this.offset, this.littleEndian);
  }
}
