import { fromDate, Time } from "@foxglove/rostime";
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
import { RtpsParticipantView } from "./RtpsParticipantView";
import { BuiltinEndpointSet, SubMessageId, VendorId } from "./enums";
import { UdpRemoteInfo, UdpSocket, UdpSocketCreate } from "./networkTypes";
import {
  AckNack,
  AckNackView,
  DataMsg,
  DataMsgView,
  HeartbeatView,
  InfoDst,
  InfoTs,
} from "./submessages";
import {
  AckNackData,
  HeartbeatData,
  DiscoveredParticipantData,
  UserData,
  DiscoveredTopicData,
} from "./types";

export interface RtpsParticipantEvents {
  error: (error: Error) => void;
  discoveredParticipant: (participant: DiscoveredParticipantData) => void;
  discoveredTopic: (topic: DiscoveredTopicData) => void;
  heartbeat: (heartbeat: HeartbeatData) => void;
  ackNack: (ackNack: AckNackData) => void;
  userData: (userData: UserData) => void;
}

type MessageHandler = (data: Uint8Array, rinfo: UdpRemoteInfo) => void;

const builtinEndpoints =
  // BuiltinEndpointSet.ParticipantAnnouncer |
  BuiltinEndpointSet.ParticipantDetector |
  // BuiltinEndpointSet.PublicationAnnouncer |
  BuiltinEndpointSet.PublicationDetector |
  // BuiltinEndpointSet.SubscriptionAnnouncer |
  BuiltinEndpointSet.SubscriptionDetector |
  // BuiltinEndpointSet.ParticipantMessageDataWriter |
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
  participants = new Map<string, RtpsParticipantView>();

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
    this.participants.clear();

    this.metatrafficUnicastSocket?.close();
    this.metatrafficMulticastSocket?.close();
    this.defaultUnicastSocket?.close();
    this.defaultMulticastSocket?.close();
  }

  async sendParticipantData(
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
      1n,
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

    await this._sendMetatrafficTo(msg, destGuidPrefix);
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

      if (msg.submessageId === SubMessageId.HEARTBEAT) {
        const heartbeat = msg as HeartbeatView;
        void this._handleHeartbeat({
          guidPrefix: message.guidPrefix,
          readerEntityId: heartbeat.readerEntityId,
          writerEntityId: heartbeat.writerEntityId,
          firstAvailableSeqNumber: heartbeat.firstAvailableSeqNumber,
          lastSeqNumber: heartbeat.lastSeqNumber,
          count: heartbeat.count,
        });
      } else if (msg.submessageId === SubMessageId.ACKNACK) {
        const ackNack = msg as AckNackView;
        this._handleAckNack({
          guidPrefix: message.guidPrefix,
          readerEntityId: ackNack.readerEntityId,
          writerEntityId: ackNack.writerEntityId,
          readerSNState: ackNack.readerSNState,
          count: ackNack.count,
          final: ackNack.final,
        });
      } else if (msg.submessageId === SubMessageId.DATA) {
        const dataMsg = msg as DataMsgView;
        const params = dataMsg.parameters();
        if (params != undefined) {
          // meta message
          this._handleMetaData(message.guidPrefix, params, msg.effectiveTimestamp);
        } else {
          // user data
          this._handleUserData({
            timestamp: msg.effectiveTimestamp,
            guidPrefix: message.guidPrefix,
            readerEntityId: dataMsg.readerEntityId,
            writerEntityId: dataMsg.writerEntityId,
            writerSeqNumber: dataMsg.writerSeqNumber,
            serializedData: dataMsg.serializedData,
          });
        }
      }
    }
  };

  private _handleDefaultMessage = (data: Uint8Array, rinfo: UdpRemoteInfo): void => {
    this.log?.debug?.(
      `Received ${data.length} byte default message from ${rinfo.address}:${rinfo.port}`,
    );
  };

  private _handleHeartbeat = async (heartbeat: HeartbeatData): Promise<void> => {
    this.emit("heartbeat", heartbeat);

    const destGuidPrefix = heartbeat.guidPrefix;
    const participant = this.participants.get(destGuidPrefix.toString());
    if (participant == undefined) {
      this.log?.warn?.(`Received heartbeat from unknown participant ${destGuidPrefix}`);
      return;
    }

    const endpoint = participant.endpoints.get(heartbeat.writerEntityId.value);
    if (endpoint == undefined) {
      this.log?.warn?.(
        `Received heartbeat from participant ${destGuidPrefix} for unknown endpoint ${heartbeat.writerEntityId}`,
      );
      return;
    }

    const sequenceNumSet = endpoint.history.getMissingSequenceNums(
      heartbeat.firstAvailableSeqNumber,
      heartbeat.lastSeqNumber,
    );

    // Submessages
    const infoDst = new InfoDst(destGuidPrefix);
    const ackNack = new AckNack(
      endpoint.readerEntityId,
      endpoint.writerEntityId,
      sequenceNumSet,
      ++endpoint.ackNackCount,
      false,
    );

    // RTPS message
    const msg = new RtpsMessage({ guidPrefix: this.guidPrefix });
    msg.writeSubmessage(infoDst);
    msg.writeSubmessage(ackNack);

    await this._sendMetatrafficTo(msg, destGuidPrefix);
  };

  private _handleAckNack = (ackNack: AckNackData): void => {
    this.emit("ackNack", ackNack);
  };

  private _handleMetaData = (
    guidPrefix: GuidPrefix,
    params: ParametersView,
    timestamp?: Time | undefined,
  ): void => {
    const participantData = parseParticipant(params, guidPrefix);
    if (participantData != undefined) {
      this.participants.set(guidPrefix.toString(), new RtpsParticipantView(participantData));
      this.emit("discoveredParticipant", participantData);
      return;
    }

    const topicData = parseTopic(params, guidPrefix, timestamp);
    if (topicData != undefined) {
      // this.topics.set(topicData.endpointGuid.toString(), new TopicView(topicData));
      this.emit("discoveredTopic", topicData);
      return;
    }

    const count = params.allParameters().size;
    this.log?.warn?.(`Unparseable participant from ${guidPrefix} with ${count} parameters`);
    return;
  };

  private _handleUserData = (userData: UserData): void => {
    this.emit("userData", userData);
  };

  private async _sendMetatrafficTo(msg: RtpsMessage, destGuidPrefix: GuidPrefix): Promise<void> {
    this.log?.debug?.(`Sending metatraffic message to ${destGuidPrefix}`);
    const participant = this.participants.get(destGuidPrefix.toString());
    if (participant == undefined) {
      this.log?.warn?.(`Cannot send metatraffic to unknown participant ${destGuidPrefix}`);
      return;
    }

    const locators = participant.metatrafficUnicastLocatorList;
    const payload = msg.data;
    await Promise.all(
      locators.map((locator) => {
        this.log?.debug?.(
          `Sending ${payload.length} bytes of metatraffic to ${locator} (${destGuidPrefix})`,
        );
        return this.metatrafficUnicastSocket?.send(payload, locator.port, locator.address);
      }),
    );
  }

  // private async _sendDefaultTo(msg: RtpsMessage, destGuidPrefix: GuidPrefix): Promise<void> {
  //   const participant = this.participants.get(destGuidPrefix.toString());
  //   if (participant == undefined) {
  //     this.log?.warn?.(`Cannot send metatraffic to unknown participant ${destGuidPrefix}`);
  //     return;
  //   }

  //   const locators = participant.defaultUnicastLocatorList;
  //   const payload = msg.data;
  //   await Promise.all(
  //     locators.map((locator) => {
  //       this.log?.debug?.(
  //         `Sending ${payload.length} bytes of user data to ${locator} (${destGuidPrefix})`,
  //       );
  //       return this.defaultUnicastSocket?.send(payload, locator.port, locator.address);
  //     }),
  //   );
  // }

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
    _address: string | undefined,
    messageHandler: MessageHandler,
  ): Promise<UdpSocket> {
    const socket = await this.udpSocketCreate({ type: "udp4" });
    socket.on("error", this._handleError);
    socket.on("message", messageHandler);
    await socket.bind({ port });
    await socket.setBroadcast(true);
    await socket.setMulticastTTL(64);
    await socket.addMembership(MULTICAST_IPv4);
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
): DiscoveredParticipantData | undefined {
  const protocolVersion = params.protocolVersion();
  const vendorId = params.vendorId();
  const expectsInlineQoS = params.expectsInlineQoS();
  const metatrafficUnicastLocator = params.metatrafficUnicastLocator();
  const metatrafficMulticastLocator = params.metatrafficMulticastLocator();
  const defaultUnicastLocator = params.defaultUnicastLocator();
  const defaultMulticastLocator = params.defaultMulticastLocator();
  const availableBuiltinEndpoints = params.builtinEndpointSet();
  const leaseDuration = params.participantLeaseDuration();
  const userData = params.userDataString();

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
    userData,
  };
}

function parseTopic(
  params: ParametersView,
  guidPrefix: GuidPrefix,
  timestamp?: Time,
): DiscoveredTopicData | undefined {
  const topicName = params.topicName();
  const typeName = params.typeName();
  const reliability = params.reliability();
  const history = params.history();
  const protocolVersion = params.protocolVersion();
  const vendorId = params.vendorId();
  const endpointGuid = params.endpointGuid();
  const userData = params.userDataString();

  if (
    topicName == undefined ||
    typeName == undefined ||
    reliability == undefined ||
    history == undefined ||
    protocolVersion == undefined ||
    vendorId == undefined ||
    endpointGuid == undefined
  ) {
    return undefined;
  }

  return {
    timestamp,
    guidPrefix,
    topicName,
    typeName,
    reliability,
    history,
    protocolVersion,
    vendorId,
    endpointGuid,
    userData,
  };
}

async function locatorForSocket(socket: UdpSocket): Promise<Locator | undefined> {
  const addr = await socket.localAddress();
  if (addr == undefined) {
    return undefined;
  }
  return Locator.fromUdpAddress(addr);
}
