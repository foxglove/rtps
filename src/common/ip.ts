import { fromHex } from "./hex";

export function ipv6ToBytes(ipv6: string): Uint8Array {
  const addressData = fromHex(ipv6.replace(/:/g, ""));
  if (addressData.length !== 16) {
    throw new Error(`invalid IPv6 address "${ipv6}"`);
  }
  return addressData;
}

export function ipv4ToBytes(ipv4: string): Uint8Array {
  const parts = ipv4.split(".");
  if (parts.length !== 4 || ipv4 === "0.0.0.0") {
    throw new Error(`invalid IPv4 address "${ipv4}"`);
  }
  const addressData = new Uint8Array(16);
  addressData[12] = parseInt(parts[0]!);
  addressData[13] = parseInt(parts[1]!);
  addressData[14] = parseInt(parts[2]!);
  addressData[15] = parseInt(parts[3]!);
  return addressData;
}
