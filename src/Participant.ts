import { areEqual, fromDate, fromMillis, Time } from "@foxglove/rostime";
import { EventEmitter } from "eventemitter3";

import { ParticipantAttributes } from "./ParticipantAttributes";
import { ParticipantView } from "./ParticipantView";
import {
  BuiltinEndpointSet,
  ChangeKind,
  EntityId,
  EntityIdBuiltin,
  EntityKind,
  generateGuidPrefix,
  Guid,
  guidParts,
  GuidPrefix,
  hasBuiltinEndpoint,
  HistoryKind,
  Locator,
  LoggerService,
  makeEntityId,
  makeGuid,
  ProtocolVersion,
  Reliability,
  SubMessageId,
  uint32ToHex,
  VendorId,
} from "./common";
import { parseEndpoint, parseParticipant } from "./discovery";
import { CacheChange } from "./history";
import { Message, MessageView, Parameters } from "./messaging";
import {
  AckNack,
  AckNackView,
  DataMsg,
  DataMsgView,
  Heartbeat,
  HeartbeatView,
  InfoDst,
  InfoTs,
} from "./messaging/submessages";
import {
  EndpointAttributes,
  livelinessPayload,
  matchLocalSubscription,
  Reader,
  ReaderView,
  SubscribeOpts,
  UserData,
  Writer,
  WriterView,
} from "./routing";
import {
  createMulticastUdpSocket,
  createUdpSocket,
  discoveryMulticastPort,
  locatorForSocket,
  sendMessageToUdp,
  UdpRemoteInfo,
  UdpSocket,
  UdpSocketCreate,
} from "./transport";

export interface ParticipantEvents {
  error: (error: Error) => void;
  discoveredParticipant: (participant: ParticipantAttributes) => void;
  discoveredPublication: (endpoint: EndpointAttributes) => void;
  discoveredSubscription: (endpoint: EndpointAttributes) => void;
  userData: (userData: UserData) => void;
}

const builtinEndpoints =
  BuiltinEndpointSet.ParticipantAnnouncer |
  BuiltinEndpointSet.ParticipantDetector |
  BuiltinEndpointSet.PublicationAnnouncer |
  BuiltinEndpointSet.PublicationDetector |
  BuiltinEndpointSet.SubscriptionAnnouncer |
  BuiltinEndpointSet.SubscriptionDetector |
  BuiltinEndpointSet.ParticipantMessageDataWriter |
  BuiltinEndpointSet.ParticipantMessageDataReader;

export class Participant extends EventEmitter<ParticipantEvents> {
  readonly name: string;
  readonly attributes: ParticipantAttributes;

  private readonly addresses: ReadonlyArray<string>;
  private readonly udpSocketCreate: UdpSocketCreate;
  private readonly log?: LoggerService;
  private readonly participants = new Map<GuidPrefix, ParticipantView>();
  private readonly writers = new Map<EntityId, Writer>();
  private readonly subscriptions = new Map<EntityId, SubscribeOpts>();
  private running = true;
  private unicastSocket?: UdpSocket;
  private multicastSocket?: UdpSocket;
  private nextEndpointId = 1;

  constructor(options: {
    name: string;
    addresses: string[];
    domainId?: number;
    guidPrefix?: GuidPrefix;
    udpSocketCreate: UdpSocketCreate;
    log?: LoggerService;
    protocolVersion?: ProtocolVersion;
    vendorId?: VendorId;
  }) {
    super();

    this.name = options.name;
    this.attributes = {
      guidPrefix: options.guidPrefix ?? generateGuidPrefix(),
      entityId: EntityIdBuiltin.Participant,
      protocolVersion: options.protocolVersion ?? { major: 2, minor: 1 },
      vendorId: options.vendorId ?? VendorId.EclipseCycloneDDS,
      domainId: options.domainId ?? 0,
      expectsInlineQoS: false,
      metatrafficUnicastLocatorList: [],
      metatrafficMulticastLocatorList: [],
      defaultUnicastLocatorList: [],
      defaultMulticastLocatorList: [],
      availableBuiltinEndpoints: builtinEndpoints,
      leaseDuration: { sec: 10, nsec: 0 },
    };

    this.addresses = options.addresses;
    this.udpSocketCreate = options.udpSocketCreate;
    this.log = options.log;

    const endpoints = this.attributes.availableBuiltinEndpoints;
    this.addBuiltinWriter(endpoints, BuiltinEndpointSet.ParticipantAnnouncer, EntityIdBuiltin.ParticipantWriter); // prettier-ignore
    this.addBuiltinWriter(endpoints, BuiltinEndpointSet.PublicationAnnouncer, EntityIdBuiltin.PublicationsWriter); // prettier-ignore
    this.addBuiltinWriter(endpoints, BuiltinEndpointSet.SubscriptionAnnouncer, EntityIdBuiltin.SubscriptionsWriter); // prettier-ignore
    this.addBuiltinWriter(endpoints, BuiltinEndpointSet.ParticipantMessageDataWriter, EntityIdBuiltin.ParticipantMessageWriter); // prettier-ignore
  }

  async start(): Promise<void> {
    // TODO: Listen on all interfaces
    const address = this.addresses[0]!;
    this.log?.debug?.(`Starting participant ${this.name} on ${address}`);

    // Create the multicast UDP socket for discovering other participants and advertising ourself
    this.multicastSocket = await createMulticastUdpSocket(
      discoveryMulticastPort(this.attributes.domainId),
      this.udpSocketCreate,
      this.handleUdpMessage,
      this.handleError,
    );
    const multiAddr = await this.multicastSocket.localAddress();
    if (multiAddr != undefined) {
      this.log?.debug?.(`Listening on UDP multicast ${multiAddr?.address}:${multiAddr?.port}`);
    } else {
      this.log?.warn?.(`Failed to bind UDP multicast socket to ${address}`);
    }

    // Create the unicast UDP socket for sending and receiving directly to participants
    this.unicastSocket = await createUdpSocket(
      address,
      this.udpSocketCreate,
      this.handleUdpMessage,
      this.handleError,
    );
    const locator = await locatorForSocket(this.unicastSocket);
    if (locator != undefined) {
      this.log?.debug?.(`Listening on UDP ${locator.address}:${locator.port}`);
      this.attributes.defaultUnicastLocatorList = [locator];
      this.attributes.metatrafficUnicastLocatorList = [locator];
    } else {
      this.log?.warn?.(`Failed to bind UDP socket to ${address}`);
    }
  }

  shutdown(): void {
    this.log?.debug?.("shutting down");
    this.running = false;
    this.removeAllListeners();
    this.participants.clear();

    this.multicastSocket?.close();
    this.unicastSocket?.close();
    this.attributes.defaultUnicastLocatorList = [];
    this.attributes.defaultMulticastLocatorList = [];
    this.attributes.metatrafficUnicastLocatorList = [];
    this.attributes.metatrafficMulticastLocatorList = [];
  }

  async sendAlive(): Promise<void> {
    const srcSocket = this.unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const writer = this.writers.get(EntityIdBuiltin.ParticipantMessageWriter);
    if (writer == undefined) {
      return;
    }

    writer.history.add({
      timestamp: fromDate(new Date()),
      kind: ChangeKind.Alive,
      writerGuid: makeGuid(this.attributes.guidPrefix, EntityIdBuiltin.ParticipantMessageWriter),
      sequenceNumber: writer.history.nextSequenceNum(),
      data: livelinessPayload(this.attributes.guidPrefix),
    });

    await this.sendChanges(writer);
  }

  async sendChanges(writer: Writer): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const participant of this.participants.values()) {
      const readers = participant.remoteReadersForWriterId(writer.attributes.entityId);
      for (const reader of readers) {
        promises.push(
          this.sendChangesTo(reader, writer, participant.attributes.defaultUnicastLocatorList),
        );
      }
    }
    await Promise.all(promises);
  }

  async sendChangesTo(reader: ReaderView, writer: Writer, locators: Locator[]): Promise<void> {
    if (this.unicastSocket == undefined) {
      return;
    }

    // Use the sequence number set to determine which messages to send
    const changes: CacheChange[] = [];
    for (const seqNum of reader.readerSNState.sequenceNumbers()) {
      const change = writer.history.get(seqNum);
      if (change != undefined) {
        changes.push(change);
      }
    }

    const maxAcked = reader.readerSNState.maxSequenceNumber();
    const maxWritten = writer.history.getSequenceNumMax() ?? 0n;
    for (let seqNum = maxAcked + 1n; seqNum <= maxWritten; seqNum++) {
      const change = writer.history.get(seqNum);
      if (change != undefined) {
        changes.push(change);
      }
    }

    // FIXME: Break up UDP packets at the MTU
    const msg = new Message(this.attributes);
    msg.writeSubmessage(new InfoDst(reader.attributes.guidPrefix));

    const readerEntityId = reader.attributes.entityId;
    const writerEntityId = writer.attributes.entityId;

    let curTime: Time = { sec: -1, nsec: 0 };
    for (const change of changes) {
      // Write an INFO_TS (timestamp) submessage if necessary
      if (!areEqual(curTime, change.timestamp)) {
        msg.writeSubmessage(new InfoTs(change.timestamp));
        curTime = change.timestamp;
      }

      // Write the DATA submessage
      msg.writeSubmessage(
        new DataMsg(readerEntityId, writerEntityId, change.sequenceNumber, change.data),
      );
    }

    // Append a HEARTBEAT message
    const firstSeq = writer.history.getSequenceNumMin() ?? 1n;
    const lastSeq = writer.history.getSequenceNumMax() ?? 0n;
    msg.writeSubmessage(
      new Heartbeat(readerEntityId, writerEntityId, firstSeq, lastSeq, ++reader.count, true, false),
    );

    // Send this message as a UDP packet
    await sendMessageToUdp(msg, this.unicastSocket, locators);
  }

  async subscribe(opts: SubscribeOpts): Promise<void> {
    const writer = this.writers.get(EntityIdBuiltin.SubscriptionsWriter);
    if (writer == undefined) {
      throw new Error(`Cannot subscribe without SubscriptionsWriter`);
    }

    // Create a reader entityId/Guid for this subscription
    const subscriptionId = this.nextEndpointId++;
    const readerEntityId = makeEntityId(subscriptionId, EntityKind.AppdefReaderNoKey);
    const readerGuid = makeGuid(this.attributes.guidPrefix, readerEntityId);

    this.log?.info?.(
      `Creating subscription ${readerGuid} for ${opts.topicName} (${opts.typeName})`,
    );
    this.subscriptions.set(readerEntityId, opts);

    // Match this subscription against existing writers (published topics)
    const local = this.attributes;
    for (const participant of this.participants.values()) {
      for (const writerEntityId of participant.remoteWriters.keys()) {
        matchLocalSubscription(local, readerEntityId, writerEntityId, opts, participant, this.log);
      }
    }

    // Parameter list
    const parameters = new Parameters();
    parameters.topicName(opts.topicName);
    parameters.typeName(opts.typeName);
    parameters.reliability(opts.reliability);
    parameters.history(opts.history);
    parameters.protocolVersion(this.attributes.protocolVersion);
    parameters.vendorId(this.attributes.vendorId);
    parameters.endpointGuid(readerGuid);
    parameters.adlinkEntityFactory(1);
    parameters.finish();

    writer.history.add({
      timestamp: fromDate(new Date()),
      kind: ChangeKind.Alive,
      writerGuid: makeGuid(this.attributes.guidPrefix, EntityIdBuiltin.SubscriptionsWriter),
      sequenceNumber: writer.history.nextSequenceNum(),
      data: parameters.data,
    });

    await this.sendChanges(writer);
  }

  async unsubscribe(): Promise<void> {
    // FIXME: Implement unsubscribe
    throw new Error(`Not implemented`);
  }

  async advertiseParticipant(attributes: ParticipantAttributes): Promise<void> {
    const writer = this.writers.get(EntityIdBuiltin.ParticipantWriter);
    if (writer == undefined) {
      throw new Error(`Cannot advertise participant without ParticipantWriter`);
    }

    // Parameter list
    const parameters = new Parameters();
    parameters.userDataString("enclave=/;");
    parameters.protocolVersion(attributes.protocolVersion);
    parameters.vendorId(attributes.vendorId);
    parameters.participantLeaseDuration(attributes.leaseDuration);
    parameters.participantGuid(makeGuid(attributes.guidPrefix, EntityIdBuiltin.Participant));
    parameters.builtinEndpointSet(attributes.availableBuiltinEndpoints);
    parameters.domainId(attributes.domainId);
    for (const locator of attributes.defaultUnicastLocatorList) {
      parameters.defaultUnicastLocator(locator);
    }
    for (const locator of attributes.metatrafficUnicastLocatorList) {
      parameters.defaultUnicastLocator(locator);
    }
    parameters.finish();

    writer.history.add({
      timestamp: fromDate(new Date()),
      kind: ChangeKind.Alive,
      writerGuid: makeGuid(attributes.guidPrefix, EntityIdBuiltin.ParticipantWriter),
      sequenceNumber: writer.history.nextSequenceNum(),
      data: parameters.data,
    });

    await this.sendChanges(writer);
  }

  private async sendAckNackTo(
    reader: Reader,
    guidPrefix: GuidPrefix,
    writerEntityId: EntityId,
    firstAvailableSeqNumber: bigint,
    lastSeqNumber: bigint,
    final: boolean,
    locators: Locator[],
  ): Promise<void> {
    const srcSocket = this.unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const readerEntityId = reader.attributes.entityId;
    const sequenceNumSet = reader.history.getMissingSequenceNums(
      firstAvailableSeqNumber,
      lastSeqNumber,
    );

    // If the final flag is set and we have no missing sequence numbers, do not send an ACKNACK
    if (final && sequenceNumSet.empty()) {
      return;
    }

    this.log?.debug?.(
      `ACKNACK to ${makeGuid(guidPrefix, writerEntityId)}, ${sequenceNumSet.toString()}`,
    );

    // RTPS message
    const msg = new Message(this.attributes);
    msg.writeSubmessage(new InfoDst(guidPrefix));
    msg.writeSubmessage(
      new AckNack(readerEntityId, writerEntityId, sequenceNumSet, ++reader.count, final),
    );

    await sendMessageToUdp(msg, srcSocket, locators);
  }

  private addBuiltinWriter(
    endpointsAvailable: BuiltinEndpointSet,
    flag: BuiltinEndpointSet,
    writerEntityId: EntityId,
  ): void {
    if (!hasBuiltinEndpoint(endpointsAvailable, flag)) {
      return;
    }

    const writer = new Writer({
      guidPrefix: this.attributes.guidPrefix,
      entityId: writerEntityId,
      reliability: { kind: Reliability.Reliable, maxBlockingTime: fromMillis(100) },
      history: { kind: HistoryKind.KeepLast, depth: 0 },
      protocolVersion: this.attributes.protocolVersion,
      vendorId: this.attributes.vendorId,
    });
    this.writers.set(writerEntityId, writer);
  }

  private getReaders(readerEntityId: EntityId, writerGuid: Guid): Reader[] {
    const [guidPrefix, writerEntityId] = guidParts(writerGuid);
    const participant = this.participants.get(guidPrefix);
    if (participant == undefined) {
      return [];
    }

    if (readerEntityId !== EntityIdBuiltin.Unknown) {
      const reader = participant.localReaders.get(readerEntityId);
      return reader != undefined ? [reader] : [];
    }

    return participant.localReadersForWriterId(writerEntityId);
  }

  private handleError = (err: Error): void => {
    if (this.running) {
      this.log?.warn?.(`${this.toString()} error: ${err}`);
      this.emit("error", err);
    }
  };

  private handleUdpMessage = (data: Uint8Array, rinfo: UdpRemoteInfo): void => {
    this.log?.debug?.(`Received ${data.length} byte message from ${rinfo.address}:${rinfo.port}`);

    const message = new MessageView(data);
    const version = message.protocolVersion;
    if (version.major !== 2) {
      const { major, minor } = version;
      this.log?.debug?.(`Received message with unsupported protocol ${major}.${minor}`);
      return;
    }

    const subMessages = message.subMessages();
    for (const msg of subMessages) {
      const dstGuidPrefix = msg.effectiveGuidPrefix;
      if (dstGuidPrefix != undefined && dstGuidPrefix !== this.attributes.guidPrefix) {
        // This is not our message
        continue;
      }

      if (msg.submessageId === SubMessageId.HEARTBEAT) {
        this.handleHeartbeat(message.guidPrefix, msg as HeartbeatView);
      } else if (msg.submessageId === SubMessageId.ACKNACK) {
        this.handleAckNack(message.guidPrefix, msg as AckNackView);
      } else if (msg.submessageId === SubMessageId.DATA) {
        this.handleDataMsg(message.guidPrefix, msg as DataMsgView);
      }
    }
  };

  private handleHeartbeat = (guidPrefix: GuidPrefix, heartbeat: HeartbeatView): void => {
    this.log?.debug?.(
      `  [SUBMSG] HEARTBEAT reader=${uint32ToHex(heartbeat.readerEntityId)} writer=${uint32ToHex(
        heartbeat.writerEntityId,
      )} ${heartbeat.firstAvailableSeqNumber},${heartbeat.lastSeqNumber} (count=${
        heartbeat.count
      }, liveliness=${heartbeat.liveliness}, final=${heartbeat.final})`,
    );

    const srcSocket = this.unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const participant = this.participants.get(guidPrefix);
    if (participant == undefined) {
      this.log?.warn?.(`Received heartbeat from unknown participant ${guidPrefix}`);
      return;
    }

    const writerView = participant.remoteWriters.get(heartbeat.writerEntityId);
    if (writerView != undefined) {
      writerView.firstAvailableSeqNum = heartbeat.firstAvailableSeqNumber;
      writerView.lastSeqNum = heartbeat.lastSeqNumber;
    }

    const writerGuid = makeGuid(guidPrefix, heartbeat.writerEntityId);
    const readers = this.getReaders(heartbeat.readerEntityId, writerGuid);
    if (readers.length === 0) {
      this.log?.warn?.(
        `Received unrecognized heartbeat reader=${heartbeat.readerEntityId}, writer=${writerGuid}`,
      );
      return;
    }

    for (const reader of readers) {
      void this.sendAckNackTo(
        reader,
        guidPrefix,
        heartbeat.writerEntityId,
        heartbeat.firstAvailableSeqNumber,
        heartbeat.lastSeqNumber,
        heartbeat.final,
        participant.attributes.metatrafficUnicastLocatorList,
      );
    }
  };

  private handleAckNack = (guidPrefix: GuidPrefix, ackNack: AckNackView): void => {
    this.log?.debug?.(
      `  [SUBMSG] ACKNACK reader=${uint32ToHex(ackNack.readerEntityId)} writer=${uint32ToHex(
        ackNack.writerEntityId,
      )} ${ackNack.readerSNState.toString()}`,
    );

    const srcSocket = this.unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const participant = this.participants.get(guidPrefix);
    if (participant == undefined) {
      this.log?.warn?.(`Received acknack from unknown participant ${guidPrefix}`);
      return;
    }

    const readerView = participant.remoteReaders.get(ackNack.readerEntityId);
    if (readerView == undefined) {
      this.log?.warn?.(`Received acknack for unknown reader ${ackNack.readerEntityId}`);
      return;
    }

    readerView.readerSNState = ackNack.readerSNState;

    const writer = this.writers.get(ackNack.writerEntityId);
    if (writer == undefined) {
      this.log?.warn?.(`Received acknack for unknown writer ${ackNack.writerEntityId}`);
      return;
    }

    void this.sendChangesTo(readerView, writer, participant.attributes.defaultUnicastLocatorList);
  };

  private handleDataMsg = (guidPrefix: GuidPrefix, dataMsg: DataMsgView): void => {
    const writerGuid = makeGuid(guidPrefix, dataMsg.writerEntityId);
    const timestamp = dataMsg.effectiveTimestamp ?? fromDate(new Date());
    const sequenceNumber = dataMsg.writerSeqNumber;
    const data = dataMsg.serializedData;

    // Get all of our readers for this writer
    const readers = this.getReaders(dataMsg.readerEntityId, writerGuid);
    this.log?.debug?.(
      `  [SUBMSG] DATA reader=${uint32ToHex(dataMsg.readerEntityId)} writer=${uint32ToHex(
        dataMsg.writerEntityId,
      )} ${data.length} bytes (seq ${sequenceNumber}) from ${writerGuid}, ${
        readers.length
      } reader(s)`,
    );

    for (const reader of readers) {
      // Record this data message into the reader's history
      reader.history.add({
        timestamp,
        kind: ChangeKind.Alive,
        writerGuid,
        sequenceNumber,
        data,
      });
    }

    switch (dataMsg.writerEntityId) {
      case EntityIdBuiltin.PublicationsWriter:
        this.handlePublication(dataMsg, timestamp);
        break;
      case EntityIdBuiltin.SubscriptionsWriter:
        this.handleSubscription(dataMsg, timestamp);
        break;
      case EntityIdBuiltin.ParticipantWriter:
        this.handleParticipant(guidPrefix, dataMsg, timestamp);
        break;
      case EntityIdBuiltin.ParticipantMessageWriter:
        this.handleParticipantMessage(guidPrefix, dataMsg, timestamp);
        break;
      case EntityIdBuiltin.TypeLookupRequestWriter:
        this.log?.warn?.(`Received type lookup request from ${guidPrefix}`);
        break;
      case EntityIdBuiltin.TypeLookupReplyWriter:
        this.log?.warn?.(`Received type lookup reply from ${guidPrefix}`);
        break;
      default:
        this.log?.warn?.(`Received data message from unhandled writer ${dataMsg.writerEntityId}`);
        break;
    }
  };

  private async sendInitialHeartbeats(participant: ParticipantView): Promise<void> {
    const srcSocket = this.unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const msg = new Message(this.attributes);

    for (const writer of this.writers.values()) {
      const readers = participant.remoteReadersForWriterId(writer.attributes.entityId);
      const firstSeq = writer.history.getSequenceNumMin() ?? 1n;
      const lastSeq = writer.history.getSequenceNumMax() ?? 0n;

      for (const reader of readers) {
        msg.writeSubmessage(
          new Heartbeat(
            reader.attributes.entityId,
            writer.attributes.entityId,
            firstSeq,
            lastSeq,
            ++reader.count,
            true,
            false,
          ),
        );
      }
    }

    // Send this message as a UDP packet
    await sendMessageToUdp(msg, srcSocket, participant.attributes.metatrafficUnicastLocatorList);
  }

  private handleParticipant = (
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
      participant = new ParticipantView(this, participantData);
      this.participants.set(participantData.guidPrefix, participant);
      this.emit("discoveredParticipant", participantData);

      // Send preemptive heartbeats for participant readers
      void this.sendInitialHeartbeats(participant);
    } else {
      this.log?.info?.(`Updating participant ${participantData.guidPrefix}`);
      participant.update(participantData);
    }
  };

  private handleParticipantMessage = (
    senderGuidPrefix: GuidPrefix,
    dataMsg: DataMsgView,
    _timestamp: Time | undefined,
  ): void => {
    // TODO: Handle this when we have a concept of participant alive/stale states
    this.log?.debug?.(
      `Received participant message from ${makeGuid(senderGuidPrefix, dataMsg.writerEntityId)}`,
    );
  };

  private handlePublication = (dataMsg: DataMsgView, timestamp: Time | undefined): void => {
    const attributes = parseEndpoint(dataMsg.parameters(), timestamp);
    if (attributes == undefined) {
      this.log?.warn?.(
        `Failed to parse publication attributes from ${dataMsg.serializedData.length} byte DATA`,
      );
      return;
    }

    const writerEntityId = attributes.entityId;
    const guid = makeGuid(attributes.guidPrefix, writerEntityId);
    this.log?.debug?.(`PUB: ${guid}`);

    const participant = this.participants.get(attributes.guidPrefix);
    if (participant == undefined) {
      this.log?.warn?.(`Received publication from unknown participant ${attributes.guidPrefix}`);
      return;
    }

    if (!participant.remoteWriters.has(writerEntityId)) {
      this.log?.info?.(
        `Tracking publication ${attributes.topicName} (${attributes.typeName}) (${guid})`,
      );
    }

    // Create or update a WriterView for this publication
    let writerView = participant.remoteWriters.get(writerEntityId);
    if (writerView == undefined) {
      writerView = new WriterView(attributes);
      participant.remoteWriters.set(writerEntityId, writerView);

      const local = this.attributes;
      for (const [readerEntityId, opts] of this.subscriptions.entries()) {
        matchLocalSubscription(local, readerEntityId, writerEntityId, opts, participant, this.log);
      }
    } else {
      writerView.attributes = attributes;
    }

    this.emit("discoveredPublication", attributes);
  };

  private handleSubscription = (dataMsg: DataMsgView, timestamp: Time | undefined): void => {
    const attributes = parseEndpoint(dataMsg.parameters(), timestamp);
    if (attributes == undefined) {
      this.log?.warn?.(`Failed to parse subscription attributes from ${dataMsg.offset} byte DATA`);
      return;
    }

    const guid = makeGuid(attributes.guidPrefix, attributes.entityId);
    this.log?.debug?.(`SUB: ${guid}`);

    const participant = this.participants.get(attributes.guidPrefix);
    if (participant == undefined) {
      this.log?.warn?.(`Received subscription from unknown participant ${attributes.guidPrefix}`);
      return;
    }

    if (!participant.remoteReaders.has(attributes.entityId)) {
      this.log?.info?.(
        `Tracking subscription ${attributes.topicName} (${attributes.typeName}) (${guid})`,
      );
    }

    // Create or update a ReaderView for this subscription
    let readerView = participant.remoteReaders.get(attributes.entityId);
    if (readerView == undefined) {
      // FIXME: Search for publications that match this subscription
      readerView = new ReaderView(attributes);
      participant.remoteReaders.set(attributes.entityId, readerView);
    } else {
      readerView.attributes = attributes;
    }

    this.emit("discoveredSubscription", attributes);
  };
}
