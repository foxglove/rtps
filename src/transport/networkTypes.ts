export interface NetworkInterface {
  name: string;
  family: "IPv4" | "IPv6";
  internal: boolean;
  address: string;
  cidr?: string;
  mac: string;
  netmask: string;
}

export type UdpAddress = {
  port: number;
  family: string;
  address: string;
};

export type UdpRemoteInfo = {
  address: string;
  family: "IPv4" | "IPv6";
  port: number;
  size: number;
};

export type UdpBindOptions = {
  port?: number;
  address?: string;
};

export type UdpSocketOptions = {
  type: "udp4" | "udp6";
  reuseAddr?: boolean | undefined;
  ipv6Only?: boolean | undefined;
  recvBufferSize?: number | undefined;
  sendBufferSize?: number | undefined;
};

export interface UdpSocketEvents {
  close: () => void;
  listening: () => void;
  error: (err: Error) => void;
  message: (data: Uint8Array, rinfo: UdpRemoteInfo) => void;
}

export interface UdpSocket {
  remoteAddress(): Promise<UdpAddress | undefined>;
  localAddress(): Promise<UdpAddress | undefined>;
  addMembership(multicastAddress: string, multicastInterface?: string): Promise<void>;
  bind(options: UdpBindOptions): Promise<void>;
  close(): Promise<void>;
  dispose(): Promise<void>;
  dropMembership(multicastAddress: string, multicastInterface?: string): Promise<void>;
  send(
    data: Uint8Array,
    offset: number,
    length: number,
    port: number,
    address: string,
  ): Promise<void>;
  setBroadcast(flag: boolean): Promise<void>;
  setMulticastInterface(multicastInterface: string): Promise<void>;
  setMulticastLoopback(flag: boolean): Promise<void>;
  setMulticastTTL(ttl: number): Promise<void>;

  on(eventName: "close", listener: () => void): this;
  on(eventName: "listening", listener: () => void): this;
  on(eventName: "error", listener: (err: Error) => void): this;
  on(eventName: "message", listener: (data: Uint8Array, rinfo: UdpRemoteInfo) => void): this;
}

export interface UdpSocketCreate {
  (options: UdpSocketOptions): Promise<UdpSocket>;
}
