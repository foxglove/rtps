import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { uint32ToHex } from "./toHex";

export class GuidPrefix {
  constructor(public hostId: number, public appId: number, public instanceId: number) {}

  equals(other: GuidPrefix): boolean {
    return (
      this.hostId === other.hostId &&
      this.appId === other.appId &&
      this.instanceId === other.instanceId
    );
  }

  write(output: DataView, offset: number): void {
    output.setUint32(offset, this.hostId, false);
    output.setUint32(offset + 4, this.appId, false);
    output.setUint32(offset + 8, this.instanceId, false);
  }

  toCDR(writer: CdrWriter): void {
    writer.uint32BE(this.hostId);
    writer.uint32BE(this.appId);
    writer.uint32BE(this.instanceId);
  }

  toString(): string {
    return uint32ToHex(this.hostId) + uint32ToHex(this.appId) + uint32ToHex(this.instanceId);
  }

  static fromData(view: DataView, offset: number): GuidPrefix {
    return new GuidPrefix(
      view.getUint32(offset, false),
      view.getUint32(offset + 4, false),
      view.getUint32(offset + 8, false),
    );
  }

  static fromCDR(reader: CdrReader): GuidPrefix {
    return new GuidPrefix(reader.uint32BE(), reader.uint32BE(), reader.uint32BE());
  }

  static random(): GuidPrefix {
    const hostId = 0x11111111;
    const appId = 0x22222222;
    const instanceId = 0x33333333;
    // const hostId = Math.floor(Math.random() * Math.pow(2, 32));
    // const appId = Math.floor(Math.random() * Math.pow(2, 32));
    // const instanceId = Math.floor(Math.random() * Math.pow(2, 32));
    return new GuidPrefix(hostId, appId, instanceId);
  }
}
