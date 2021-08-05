import dgram from "dgram";
import EventEmitter from "eventemitter3";

import { UdpAddress, UdpBindOptions, UdpSocket, UdpSocketEvents } from "../transport";

export class UdpSocketNode extends EventEmitter<UdpSocketEvents> implements UdpSocket {
  private _socket: dgram.Socket;

  constructor(socket: dgram.Socket) {
    super();

    this._socket = socket;
    this._socket.on("close", () => this.emit("close"));
    this._socket.on("listening", () => this.emit("listening"));
    this._socket.on("error", (err) => this.emit("error", err));
    this._socket.on("message", (msg, rinfo) => this.emit("message", msg, rinfo));
  }

  async remoteAddress(): Promise<UdpAddress | undefined> {
    return this._socket.remoteAddress();
  }

  async localAddress(): Promise<UdpAddress | undefined> {
    return this._socket.address();
  }

  async addMembership(multicastAddress: string, multicastInterface?: string): Promise<void> {
    this._socket.addMembership(multicastAddress, multicastInterface);
  }

  async bind(options: UdpBindOptions): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this._socket.on("error", reject).bind(options, () => {
        this._socket.removeListener("error", reject);
        resolve();
      });
    });
  }

  async connect(port: number, address?: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this._socket.on("error", reject).connect(port, address, () => {
        this._socket.removeListener("error", reject);
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => this._socket.close(resolve));
  }

  async dispose(): Promise<void> {
    await this.close();
  }

  async dropMembership(multicastAddress: string, multicastInterface?: string): Promise<void> {
    this._socket.dropMembership(multicastAddress, multicastInterface);
  }

  async send(data: Uint8Array, port: number, address: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this._socket.send(data, 0, data.length, port, address, (err) => {
        if (err != undefined) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async setBroadcast(flag: boolean): Promise<void> {
    this._socket.setBroadcast(flag);
  }

  async setMulticastInterface(multicastInterface: string): Promise<void> {
    this._socket.setMulticastInterface(multicastInterface);
  }

  async setMulticastLoopback(flag: boolean): Promise<void> {
    this._socket.setMulticastLoopback(flag);
  }

  async setMulticastTTL(ttl: number): Promise<void> {
    this._socket.setMulticastTTL(ttl);
  }

  static async Create(this: void): Promise<UdpSocket> {
    return new UdpSocketNode(dgram.createSocket({ type: "udp4", reuseAddr: true }));
  }
}
