import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { LocatorKind } from "./enums";
import { fromHex } from "./fromHex";
import { UdpAddress } from "./networkTypes";
import { toHexSeparated } from "./toHex";

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

  static fromUdpAddress(address: UdpAddress): Locator {
    if (address.family === "IPv6") {
      const addressData = ipv6ToBytes(address.address);
      return new Locator(LocatorKind.UDPv6, address.port, addressData);
    } else if (address.family === "IPv4") {
      const addressData = ipv4ToBytes(address.address);
      return new Locator(LocatorKind.UDPv4, address.port, addressData);
    } else {
      throw new Error(`Unrecognized UDP address family "${address.family}"`);
    }
  }
}

function ipv6ToBytes(ipv6: string): Uint8Array {
  const addressData = fromHex(ipv6.replace(/:/g, ""));
  if (addressData.length !== 16) {
    throw new Error(`Invalid IPv6 address "${ipv6}"`);
  }
  return addressData;
}

function ipv4ToBytes(ipv4: string): Uint8Array {
  const parts = ipv4.split(".");
  if (parts.length !== 4 || ipv4 === "0.0.0.0") {
    throw new Error(`Invalid IPv4 address "${ipv4}"`);
  }
  const addressData = new Uint8Array(16);
  addressData[12] = parseInt(parts[0]!);
  addressData[13] = parseInt(parts[1]!);
  addressData[14] = parseInt(parts[2]!);
  addressData[15] = parseInt(parts[3]!);
  return addressData;
}
