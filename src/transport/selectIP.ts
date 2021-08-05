import { NetworkInterface } from "./networkTypes";

export function selectIPv4(interfaces: NetworkInterface[]): string {
  let bestAddr: NetworkInterface | undefined;
  for (const iface of interfaces) {
    if (iface.family !== "IPv4" || iface.internal || iface.address.length === 0) {
      continue;
    }

    if (bestAddr == undefined) {
      // Use the first non-internal interface we find
      bestAddr = iface;
    } else if (isPrivateIP(bestAddr.address) && !isPrivateIP(iface.address)) {
      // Prefer public IPs over private
      bestAddr = iface;
    }
  }
  if (bestAddr != undefined) {
    return bestAddr.address;
  }

  // Last resort, return IPv4 loopback
  return "127.0.0.1";
}

function isPrivateIP(ip: string): boolean {
  // Logic based on isPrivateIP() in ros_comm network.cpp
  return ip.startsWith("192.168") || ip.startsWith("10.") || ip.startsWith("169.254");
}
