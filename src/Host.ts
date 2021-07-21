import { Md5 } from "md5-typescript";

import { fromHex } from "./fromHex";

const MAC_ID_LENGTH = 6;

export class Host {
  hostId: number;
  macId: Uint8Array;
  domainId: bigint;

  constructor(ipAddress: string, macAddress?: string) {
    const ipHash = fromHex(Md5.init(ipAddress));
    this.hostId = 0;
    for (let i = 0; i < ipHash.length; i += 2) {
      this.hostId ^= (ipHash[i]! << 8) | ipHash[i + 1]!;
    }

    this.macId = new Uint8Array(6);
    if (macAddress != undefined) {
      const macHash = fromHex(Md5.init(macAddress));
      for (let i = 0, j = 0; i < macHash.length; ++i, ++j) {
        if (j >= MAC_ID_LENGTH) {
          j = 0;
        }
        this.macId[j] ^= macHash[i]!;
      }
    } else {
      for (let i = 0; i < MAC_ID_LENGTH; i += 2) {
        this.macId[i] = this.hostId >> 8;
        this.macId[i + 1] = this.hostId & 0xff;
      }
    }

    this.domainId = 0n;
    for (let i = 0; i < MAC_ID_LENGTH; ++i) {
      this.domainId |= BigInt(this.macId[i]!) << (56n - BigInt(i) * 8n);
    }
  }
}
