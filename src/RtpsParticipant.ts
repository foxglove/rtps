import { Duration, fromDate, Time } from "@foxglove/rostime";
import { EventEmitter } from "eventemitter3";

import {
  discoveryMulticastPort,
  discoveryUnicastPort,
  MULTICAST_IPv4,
  userMulticastPort,
  userUnicastPort,
} from "./Discovery";
import { EntityId } from "./EntityId";
import { Guid } from "./Guid";
import { GuidPrefix } from "./GuidPrefix";
import { Locator } from "./Locator";
import { LoggerService } from "./LoggerService";
import { Parameters } from "./Parameters";
import { ParametersView } from "./ParametersView";
import { RtpsMessage } from "./RtpsMessage";
import { RtpsMessageView } from "./RtpsMessageView";
import { SequenceNumber } from "./SequenceNumber";
import { SubMessageId } from "./SubMessage";
import { BuiltinEndpointSet, VendorId } from "./enums";
import { UdpRemoteInfo, UdpSocket, UdpSocketCreate } from "./networkTypes";
import { DataMsg, DataMsgView, InfoDst, InfoTs } from "./submessages";
import { ProtocolVersion } from "./types";

export type SpdpDiscoveredParticipantData = {
  timestamp?: Time;
  guidPrefix: GuidPrefix;
  protocolVersion: ProtocolVersion;
  vendorId: VendorId;
  expectsInlineQoS: boolean;
  metatrafficUnicastLocatorList: Locator[];
  metatrafficMulticastLocatorList: Locator[];
  defaultUnicastLocatorList: Locator[];
  defaultMulticastLocatorList: Locator[];
  availableBuiltinEndpoints: BuiltinEndpointSet;
  leaseDuration: Duration;
};

export interface RtpsParticipantEvents {
  error: (error: Error) => void;
  discoveredParticipant: (participant: SpdpDiscoveredParticipantData) => void;
}

type MessageHandler = (data: Uint8Array, rinfo: UdpRemoteInfo) => void;

const builtinEndpoints =
  BuiltinEndpointSet.ParticipantAnnouncer |
  BuiltinEndpointSet.ParticipantDetector |
  BuiltinEndpointSet.PublicationAnnouncer |
  BuiltinEndpointSet.PublicationDetector |
  BuiltinEndpointSet.SubscriptionAnnouncer |
  BuiltinEndpointSet.SubscriptionDetector |
  BuiltinEndpointSet.ParticipantMessageDataWriter |
  BuiltinEndpointSet.ParticipantMessageDataReader;

export class RtpsParticipant extends EventEmitter<RtpsParticipantEvents> {
  name: string;
  participantId: number;
  domainId: number;
  guidPrefix: GuidPrefix;
  addresses: string[];
  udpSocketCreate: UdpSocketCreate;
  log?: LoggerService;
  running = true;
  metatrafficUnicastSocket?: UdpSocket;
  metatrafficMulticastSocket?: UdpSocket;
  defaultUnicastSocket?: UdpSocket;
  defaultMulticastSocket?: UdpSocket;
  metatrafficUnicastLocator?: Locator;
  defaultUnicastLocator?: Locator;

  constructor(options: {
    name: string;
    addresses: string[];
    participantId: number;
    domainId?: number;
    guidPrefix?: GuidPrefix;
    udpSocketCreate: UdpSocketCreate;
    log?: LoggerService;
  }) {
    super();

    this.name = options.name;
    this.participantId = options.participantId;
    this.domainId = options.domainId ?? 0;
    this.guidPrefix = options.guidPrefix ?? GuidPrefix.random();
    this.addresses = options.addresses;
    this.udpSocketCreate = options.udpSocketCreate;
    this.log = options.log;
  }

  async start(): Promise<void> {
    // TODO: Listen on all interfaces
    const address = this.addresses[0]!;

    this.metatrafficUnicastSocket = await this._createUdpSocket(
      discoveryUnicastPort(this.domainId, this.participantId),
      address,
      this._handleMetatrafficMessage,
    );
    this.metatrafficUnicastLocator = await locatorForSocket(this.metatrafficUnicastSocket);
    this.metatrafficMulticastSocket = await this._createMulticastUdpSocket(
      discoveryMulticastPort(this.domainId),
      address,
      this._handleMetatrafficMessage,
    );
    this.defaultUnicastSocket = await this._createUdpSocket(
      userUnicastPort(this.domainId, this.participantId),
      address,
      this._handleDefaultMessage,
    );
    this.defaultUnicastLocator = await locatorForSocket(this.defaultUnicastSocket);
    this.defaultMulticastSocket = await this._createMulticastUdpSocket(
      userMulticastPort(this.domainId),
      address,
      this._handleDefaultMessage,
    );
  }

  shutdown(): void {
    this.log?.debug?.("shutting down");
    this.running = false;
    this.removeAllListeners();

    this.metatrafficUnicastSocket?.close();
    this.metatrafficMulticastSocket?.close();
    this.defaultUnicastSocket?.close();
    this.defaultMulticastSocket?.close();
  }

  async sendParticipantData(
    destLocator: Locator,
    destGuidPrefix: GuidPrefix,
    timestamp: Time = fromDate(new Date()),
  ): Promise<void> {
    if (this.defaultUnicastLocator == undefined || this.metatrafficUnicastLocator == undefined) {
      throw new Error(`Cannot send participant data before unicast sockets are bound`);
    }

    // Parameter list
    const parameters = new Parameters();
    parameters.userDataString("enclave=/;");
    parameters.protocolVersion({ major: 2, minor: 1 });
    parameters.vendorId(VendorId.EclipseCycloneDDS);
    parameters.participantLeaseDuration({ sec: 10, nsec: 0 });
    parameters.participantGuid(new Guid(this.guidPrefix, EntityId.Participant));
    parameters.builtinEndpointSet(builtinEndpoints);
    parameters.domainId(this.domainId);
    parameters.defaultUnicastLocator(this.defaultUnicastLocator);
    parameters.metatrafficUnicastLocator(this.metatrafficUnicastLocator);
    parameters.finish();

    // Submessages
    const infoDst = new InfoDst(destGuidPrefix);
    const infoTs = new InfoTs(timestamp);
    const dataMsg = new DataMsg(
      EntityId.BuiltinParticipantReader,
      EntityId.BuiltinParticipantWriter,
      SequenceNumber.fromBigInt(1n),
      parameters.data,
      false,
      true,
      false,
    );

    // RTPS message
    const msg = new RtpsMessage({ guidPrefix: this.guidPrefix });
    msg.writeSubmessage(infoDst);
    msg.writeSubmessage(infoTs);
    msg.writeSubmessage(dataMsg);

    const data = msg.data;
    this.log?.debug?.(
      `Sending ${data.length} byte participant data message to ${destLocator} (${destGuidPrefix})`,
    );
    await this.metatrafficUnicastSocket?.send(msg.data, destLocator.port, destLocator.address);
  }

  private _handleError = (err: Error): void => {
    if (this.running) {
      this.log?.warn?.(`${this.toString()} error: ${err}`);
      this.emit("error", err);
    }
  };

  private _handleMetatrafficMessage = (data: Uint8Array, rinfo: UdpRemoteInfo): void => {
    this.log?.debug?.(
      `Received ${data.length} byte metatraffic message from ${rinfo.address}:${rinfo.port}`,
    );

    const message = new RtpsMessageView(data);
    const version = message.protocolVersion;
    if (version.major !== 2) {
      const { major, minor } = version;
      this.log?.debug?.(`Received metatraffic message with unsupported protocol ${major}.${minor}`);
      return;
    }

    const subMessages = message.subMessages();
    for (const msg of subMessages) {
      if (!(msg.effectiveGuidPrefix?.equals(this.guidPrefix) ?? true)) {
        // This is not our message
        continue;
      }

      this.log?.debug?.(`[SUBMSG] ${SubMessageId[msg.submessageId]}`);

      if (msg.submessageId === SubMessageId.DATA) {
        const dataMsg = msg as DataMsgView;
        const params = dataMsg.parameters();
        if (params != undefined) {
          // meta message
          const otherParticipant = parseParticipant(params, message.guidPrefix);
          if (otherParticipant != undefined) {
            this.emit("discoveredParticipant", otherParticipant);
          } else {
            console.error(`parseParticipant failed`);
          }
        } else {
          // user message
        }
      }
    }
  };

  private _handleDefaultMessage = (data: Uint8Array, rinfo: UdpRemoteInfo): void => {
    this.log?.debug?.(
      `Received ${data.length} byte default message from ${rinfo.address}:${rinfo.port}`,
    );
  };

  private async _createUdpSocket(
    port: number,
    address: string | undefined,
    messageHandler: MessageHandler,
  ): Promise<UdpSocket> {
    const socket = await this.udpSocketCreate({ type: "udp4" });
    socket.on("error", this._handleError);
    socket.on("message", messageHandler);
    await socket.bind({ port, address });
    const bound = await socket.localAddress();
    this.log?.debug?.(`Listening on UDP ${bound?.address}:${bound?.port}`);
    return socket;
  }

  private async _createMulticastUdpSocket(
    port: number,
    address: string | undefined,
    messageHandler: MessageHandler,
  ): Promise<UdpSocket> {
    const socket = await this.udpSocketCreate({ type: "udp4" });
    socket.on("error", this._handleError);
    socket.on("message", messageHandler);
    await socket.bind({ port, address });
    await socket.setBroadcast(true);
    await socket.setMulticastTTL(64);
    await socket.addMembership(MULTICAST_IPv4, address);
    const bound = await socket.localAddress();
    this.log?.debug?.(
      `Listening on UDP multicast ${MULTICAST_IPv4}:${bound?.port} (interface ${bound?.address})`,
    );
    return socket;
  }
}

function parseParticipant(
  params: ParametersView,
  guidPrefix: GuidPrefix,
  timestamp?: Time,
): SpdpDiscoveredParticipantData | undefined {
  const protocolVersion = params.protocolVersion();
  const vendorId = params.vendorId();
  const expectsInlineQoS = params.expectsInlineQoS();
  const metatrafficUnicastLocator = params.metatrafficUnicastLocator();
  const metatrafficMulticastLocator = params.metatrafficMulticastLocator();
  const defaultUnicastLocator = params.defaultUnicastLocator();
  const defaultMulticastLocator = params.defaultMulticastLocator();
  const availableBuiltinEndpoints = params.builtinEndpointSet();
  const leaseDuration = params.participantLeaseDuration();

  if (
    protocolVersion == undefined ||
    vendorId == undefined ||
    availableBuiltinEndpoints == undefined ||
    leaseDuration == undefined
  ) {
    return undefined;
  }

  const metatrafficUnicastLocatorList =
    metatrafficUnicastLocator != undefined ? [metatrafficUnicastLocator] : [];
  const metatrafficMulticastLocatorList =
    metatrafficMulticastLocator != undefined ? [metatrafficMulticastLocator] : [];
  const defaultUnicastLocatorList =
    defaultUnicastLocator != undefined ? [defaultUnicastLocator] : [];
  const defaultMulticastLocatorList =
    defaultMulticastLocator != undefined ? [defaultMulticastLocator] : [];

  return {
    timestamp,
    guidPrefix,
    protocolVersion,
    vendorId,
    expectsInlineQoS,
    metatrafficUnicastLocatorList,
    metatrafficMulticastLocatorList,
    defaultUnicastLocatorList,
    defaultMulticastLocatorList,
    availableBuiltinEndpoints,
    leaseDuration,
  };
}

async function locatorForSocket(socket: UdpSocket): Promise<Locator | undefined> {
  const addr = await socket.localAddress();
  if (addr == undefined) {
    return undefined;
  }
  return Locator.fromUdpAddress(addr);
}
