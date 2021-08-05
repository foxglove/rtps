import { Locator, LocatorKind, ipv6ToBytes, ipv4ToBytes } from "../common";
import { UdpAddress } from "./networkTypes";

export const MULTICAST_IPv4 = "239.255.0.1";

const builtinMulticastPortOffset = 0;
const userMulticastPortOffset = 1;
const builtinUnicastPortOffset = 10;
const userUnicastPortOffset = 11;
const portBase = 7400;
const domainIDGain = 250;
const participantIDGain = 2;

export function discoveryMulticastPort(domainId: number): number {
  return portBase + domainIDGain * domainId + builtinMulticastPortOffset;
}

export function userMulticastPort(domainId: number): number {
  return portBase + domainIDGain * domainId + userMulticastPortOffset;
}

export function discoveryUnicastPort(domainId: number, participantId: number): number {
  return (
    portBase +
    domainIDGain * domainId +
    builtinUnicastPortOffset +
    participantIDGain * participantId
  );
}

export function userUnicastPort(domainId: number, participantId: number): number {
  return (
    portBase + domainIDGain * domainId + userUnicastPortOffset + participantIDGain * participantId
  );
}

export function locatorFromUdpAddress(address: UdpAddress): Locator {
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
