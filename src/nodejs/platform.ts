import os from "os";

import { NetworkInterface } from "../networkTypes";

export function getNetworkInterfaces(): NetworkInterface[] {
  const output: NetworkInterface[] = [];
  const ifaces = os.networkInterfaces();
  for (const [name, iface] of Object.entries(ifaces)) {
    if (iface != undefined) {
      for (const info of iface) {
        output.push({ name, ...info, cidr: info.cidr ?? undefined });
      }
    }
  }
  return output;
}
