import { Locator, LocatorKind, ipv6ToBytes, ipv4ToBytes } from "../common";
import { Message } from "../messaging";
import {
  UdpAddress,
  UdpRemoteInfo,
  UdpSocket,
  UdpSocketCreate,
  UdpSocketOptions,
} from "./networkTypes";

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
    throw new Error(`unrecognized UDP address family "${address.family}"`);
  }
}

export async function sendMessageToUdp(
  msg: Message,
  srcSocket: UdpSocket,
  locator: Locator,
): Promise<void> {
  const data = msg.data;
  if (locator.kind === LocatorKind.UDPv4) {
    await srcSocket.send(data, 0, data.length, locator.port, locator.address);
    return;
  }
}

export async function createUdpSocket(
  address: string | undefined,
  udpSocketCreate: UdpSocketCreate,
  udpSocketOptions: UdpSocketOptions | undefined,
  messageHandler: (data: Uint8Array, rinfo: UdpRemoteInfo) => void,
  errorHandler: (err: Error) => void,
): Promise<UdpSocket> {
  const socket = await udpSocketCreate({ ...{ type: "udp4" }, ...udpSocketOptions });
  socket.on("error", errorHandler);
  socket.on("message", messageHandler);
  await socket.bind({ address });
  return socket;
}

export async function createMulticastUdpSocket(
  port: number,
  udpSocketCreate: UdpSocketCreate,
  udpSocketOptions: UdpSocketOptions | undefined,
  messageHandler: (data: Uint8Array, rinfo: UdpRemoteInfo) => void,
  errorHandler: (err: Error) => void,
): Promise<UdpSocket> {
  const socket = await udpSocketCreate({ ...{ type: "udp4" }, ...udpSocketOptions });
  socket.on("error", errorHandler);
  socket.on("message", messageHandler);
  await socket.bind({ port });
  await socket.setBroadcast(true);
  await socket.setMulticastTTL(64);
  await socket.addMembership(MULTICAST_IPv4);
  return socket;
}

export async function locatorForSocket(socket: UdpSocket): Promise<Locator | undefined> {
  const addr = await socket.localAddress();
  if (addr == undefined) {
    return undefined;
  }
  return locatorFromUdpAddress(addr);
}
