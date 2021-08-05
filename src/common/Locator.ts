import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { LocatorKind } from "./enums";
import { toHexSeparated } from "./hex";
import { ipv6ToBytes, ipv4ToBytes } from "./ip";

export class Locator {
  kind: LocatorKind;
  port: number;
  address: string;

  constructor(kind: LocatorKind, port: number, addressData: Uint8Array) {
    this.kind = kind;
    this.port = port;
    if (this.kind === LocatorKind.UDPv6) {
      this.address = toHexSeparated(addressData, ":");
    } else if (this.kind === LocatorKind.UDPv4) {
      this.address = `${addressData[12]!}.${addressData[13]!}.${addressData[14]!}.${addressData[15]!}`;
    } else {
      this.address = "";
    }
  }

  toCDR(writer: CdrWriter): void {
    writer.uint32(this.kind);
    writer.uint32(this.port);

    if (this.kind === LocatorKind.UDPv6) {
      const addressData = ipv6ToBytes(this.address);
      writer.uint8Array(addressData, false);
    } else if (this.kind === LocatorKind.UDPv4) {
      const addressData = ipv4ToBytes(this.address);
      writer.uint8Array(addressData, false);
    } else {
      throw new Error(`Unsupported LocatorKind ${this.kind}`);
    }
  }

  toString(): string {
    return `${this.address}:${this.port} (${LocatorKind[this.kind]})`;
  }

  static fromCDR(reader: CdrReader): Locator {
    const kind = reader.uint32();
    const port = reader.uint32();
    const addressData = reader.uint8Array(16);
    return new Locator(kind, port, addressData);
  }
}
