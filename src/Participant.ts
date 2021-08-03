import { fromDate, Time } from "@foxglove/rostime";
import { EventEmitter } from "eventemitter3";

import {
  discoveryMulticastPort,
  discoveryUnicastPort,
  MULTICAST_IPv4,
  parseEndpoint,
  parseParticipant,
  userMulticastPort,
  userUnicastPort,
} from "./Discovery";
import { Endpoint } from "./Endpoint";
import {
  EntityId,
  EntityIdBuiltinParticipantMessageWriter,
  EntityIdBuiltinParticipantReader,
  EntityIdBuiltinParticipantWriter,
  EntityIdBuiltinPublicationsWriter,
  EntityIdBuiltinSubscriptionsWriter,
  EntityIdBuiltinTypeLookupReplyWriter,
  EntityIdBuiltinTypeLookupRequestWriter,
  EntityIdParticipant,
} from "./EntityId";
import { makeGuid } from "./Guid";
import { generateGuidPrefix, GuidPrefix } from "./GuidPrefix";
import { Locator } from "./Locator";
import { LoggerService } from "./LoggerService";
import { Message } from "./Message";
import { MessageView } from "./MessageView";
import { Parameters } from "./Parameters";
import { ParticipantView } from "./ParticipantView";
import { BuiltinEndpointSet, ChangeKind, SubMessageId, VendorId } from "./enums";
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
import { DiscoveredParticipantData, UserData, DiscoveredEndpointData } from "./types";

export interface ParticipantEvents {
  error: (error: Error) => void;
  discoveredParticipant: (participant: DiscoveredParticipantData) => void;
  discoveredEndpoint: (endpoint: DiscoveredEndpointData) => void;
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

export class Participant extends EventEmitter<ParticipantEvents> {
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
  participants = new Map<string, ParticipantView>();

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
    this.guidPrefix = options.guidPrefix ?? generateGuidPrefix();
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
    parameters.participantGuid(makeGuid(this.guidPrefix, EntityIdParticipant));
    parameters.builtinEndpointSet(builtinEndpoints);
    parameters.domainId(this.domainId);
    parameters.defaultUnicastLocator(this.defaultUnicastLocator);
    parameters.metatrafficUnicastLocator(this.metatrafficUnicastLocator);
    parameters.finish();

    // Submessages
    const infoDst = new InfoDst(destGuidPrefix);
    const infoTs = new InfoTs(timestamp);
    const dataMsg = new DataMsg(
      EntityIdBuiltinParticipantReader,
      EntityIdBuiltinParticipantWriter,
      1n,
      parameters.data,
      false,
      true,
      false,
    );

    // RTPS message
    const msg = new Message({ guidPrefix: this.guidPrefix });
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

    const message = new MessageView(data);
    const version = message.protocolVersion;
    if (version.major !== 2) {
      const { major, minor } = version;
      this.log?.debug?.(`Received metatraffic message with unsupported protocol ${major}.${minor}`);
      return;
    }

    const subMessages = message.subMessages();
    for (const msg of subMessages) {
      if (msg.effectiveGuidPrefix != undefined && msg.effectiveGuidPrefix !== this.guidPrefix) {
        // This is not our message
        continue;
      }

      this.log?.debug?.(` [SUBMSG] ${SubMessageId[msg.submessageId]}`);

      if (msg.submessageId === SubMessageId.HEARTBEAT) {
        this._handleHeartbeat(message.guidPrefix, msg as HeartbeatView);
      } else if (msg.submessageId === SubMessageId.ACKNACK) {
        this._handleAckNack(message.guidPrefix, msg as AckNackView);
      } else if (msg.submessageId === SubMessageId.DATA) {
        this._handleDataMsg(message.guidPrefix, msg as DataMsgView);
      }
    }
  };

  private _handleDefaultMessage = (data: Uint8Array, rinfo: UdpRemoteInfo): void => {
    this.log?.debug?.(
      `Received ${data.length} byte default message from ${rinfo.address}:${rinfo.port}`,
    );
  };

  private _handleHeartbeat = (guidPrefix: GuidPrefix, heartbeat: HeartbeatView): void => {
    const entityId = heartbeat.writerEntityId;
    const endpoint = this._getEndpoint(guidPrefix, heartbeat.writerEntityId);
    if (endpoint == undefined) {
      this.log?.warn?.(`Received heartbeat for unknown endpoint ${makeGuid(guidPrefix, entityId)}`);
      return;
    }

    const sequenceNumSet = endpoint.history.getMissingSequenceNums(
      heartbeat.firstAvailableSeqNumber,
      heartbeat.lastSeqNumber,
    );

    if (heartbeat.final && sequenceNumSet.empty()) {
      return;
    }

    // Submessages
    const infoDst = new InfoDst(guidPrefix);
    const ackNack = new AckNack(
      endpoint.readerEntityId,
      endpoint.writerEntityId,
      sequenceNumSet,
      ++endpoint.participant.ackNackCount,
      true,
    );

    // RTPS message
    const msg = new Message({ guidPrefix: this.guidPrefix });
    msg.writeSubmessage(infoDst);
    msg.writeSubmessage(ackNack);

    this.log?.debug?.(
      `Responding to heartbeat for ${makeGuid(guidPrefix, entityId)} (${endpoint.data.topicName})`,
    );

    void this._sendMetatrafficTo(msg, guidPrefix);
  };

  private _handleAckNack = (_guidPrefix: GuidPrefix, _ackNack: AckNackView): void => {
    // no-op for now
  };

  private _handleDataMsg = (guidPrefix: GuidPrefix, dataMsg: DataMsgView): void => {
    const timestamp = dataMsg.effectiveTimestamp;

    // Record this message into a HistoryCache if it belongs to an endpoint we're tracking
    const endpoint = this._getEndpoint(guidPrefix, dataMsg.writerEntityId);
    if (endpoint != undefined) {
      this._recordChange(guidPrefix, dataMsg, endpoint);
    }

    switch (dataMsg.writerEntityId) {
      case EntityIdBuiltinPublicationsWriter:
        this._handlePublicationOrSubscription(true, guidPrefix, dataMsg, timestamp);
        break;
      case EntityIdBuiltinSubscriptionsWriter:
        this._handlePublicationOrSubscription(false, guidPrefix, dataMsg, timestamp);
        break;
      case EntityIdBuiltinParticipantWriter:
        this._handleParticipant(guidPrefix, dataMsg, timestamp);
        break;
      case EntityIdBuiltinParticipantMessageWriter:
        this._handleParticipantMessage(guidPrefix, dataMsg, timestamp);
        break;
      case EntityIdBuiltinTypeLookupRequestWriter:
        this.log?.warn?.(`Received type lookup request from ${guidPrefix}`);
        break;
      case EntityIdBuiltinTypeLookupReplyWriter:
        this.log?.warn?.(`Received type lookup reply from ${guidPrefix}`);
        break;
      default:
        this.log?.warn?.(`Received data message from unhandled writer ${dataMsg.writerEntityId}`);
        break;
    }
  };

  private _handleParticipant = (
    senderGuidPrefix: GuidPrefix,
    dataMsg: DataMsgView,
    timestamp: Time | undefined,
  ): void => {
    const params = dataMsg.parameters();
    if (params == undefined) {
      this.log?.warn?.(`Ignoring participant message with no parameters from ${senderGuidPrefix}`);
      return;
    }

    const participantData = parseParticipant(params, timestamp);
    if (participantData == undefined) {
      this.log?.warn?.(`Failed to parse participant data from ${senderGuidPrefix}`);
      return;
    }

    let participant = this.participants.get(participantData.guidPrefix);
    if (participant == undefined) {
      this.log?.info?.(`Tracking participant ${participantData.guidPrefix}`);
      participant = new ParticipantView(participantData);
      this.participants.set(participantData.guidPrefix, participant);
      this.emit("discoveredParticipant", participantData);
    } else {
      this.log?.info?.(`Updating participant ${participantData.guidPrefix}`);
      participant.update(participantData);
    }
  };

  private _handleParticipantMessage = (
    _senderGuidPrefix: GuidPrefix,
    _dataMsg: DataMsgView,
    _timestamp: Time | undefined,
  ): void => {
    // TODO: Handle this when we have a concept of participant alive/stale states
    this.log?.debug?.(`Received participant message from ${_dataMsg.writerEntityId}`);
  };

  private _handlePublicationOrSubscription = (
    isPublication: boolean,
    senderGuidPrefix: GuidPrefix,
    dataMsg: DataMsgView,
    timestamp: Time | undefined,
  ): void => {
    const params = dataMsg.parameters();
    if (params == undefined) {
      this.log?.warn?.(`Ignoring endpoint with no parameters from ${senderGuidPrefix}`);
      return;
    }

    const endpointData = parseEndpoint(params, timestamp);
    if (endpointData == undefined) {
      this.log?.warn?.(
        `Failed to parse endpoint data from ${senderGuidPrefix}:\n${params.allParameters()}`,
      );
      return;
    }

    const participant = this.participants.get(endpointData.guidPrefix);
    if (participant == undefined) {
      this.log?.warn?.(`Received endpoint from unknown participant ${endpointData.guidPrefix}`);
      return;
    }

    if (!participant.endpoints.has(endpointData.entityId)) {
      this.log?.info?.(
        `Tracking ${isPublication ? "publication" : "subscription"} ${endpointData.topicName} (${
          endpointData.typeName
        }) (${makeGuid(endpointData.guidPrefix, endpointData.entityId)}). readerEntityId=${
          dataMsg.readerEntityId
        }, writerEntityId=${dataMsg.writerEntityId}`,
      );

      participant.endpoints.set(
        endpointData.entityId,
        new Endpoint({
          participant,
          readerEntityId: dataMsg.readerEntityId,
          writerEntityId: dataMsg.writerEntityId,
          data: endpointData,
        }),
      );
      if (endpointData.topicName != undefined) {
        participant.topicToEntityId.set(endpointData.topicName, endpointData.entityId);
      }

      this.emit("discoveredEndpoint", endpointData);
    }
  };

  private _recordChange(guidPrefix: GuidPrefix, dataMsg: DataMsgView, endpoint: Endpoint) {
    const writerGuid = makeGuid(guidPrefix, dataMsg.writerEntityId);
    const sequenceNumber = dataMsg.writerSeqNumber;
    const serializedData = dataMsg.serializedData;
    this.log?.debug?.(
      `  DATA: ${serializedData.length} bytes (seq ${sequenceNumber}) from ${writerGuid} (history is size ${endpoint.history.size})`,
    );
    endpoint.history.add(sequenceNumber, {
      timestamp: dataMsg.effectiveTimestamp ?? fromDate(new Date()),
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber,
      data: serializedData,
    });
  }

  private _getEndpoint(guidPrefix: GuidPrefix, entityId: EntityId): Endpoint | undefined {
    return this.participants.get(guidPrefix)?.endpoints.get(entityId);
  }

  private async _sendMetatrafficTo(msg: Message, destGuidPrefix: GuidPrefix): Promise<void> {
    const participant = this.participants.get(destGuidPrefix);
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

  // private async _sendDefaultTo(msg: Message, destGuidPrefix: GuidPrefix): Promise<void> {
  //   const participant = this.participants.get(destGuidPrefix);
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

async function locatorForSocket(socket: UdpSocket): Promise<Locator | undefined> {
  const addr = await socket.localAddress();
  if (addr == undefined) {
    return undefined;
  }
  return Locator.fromUdpAddress(addr);
}
