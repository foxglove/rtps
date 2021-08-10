import { areEqual, fromDate, fromMillis, Time } from "@foxglove/rostime";
import { EventEmitter } from "eventemitter3";

import { ParticipantAttributes } from "./ParticipantAttributes";
import { ParticipantView } from "./ParticipantView";
import {
  EntityId,
  EntityIdBuiltin,
  makeEntityId,
  makeGuid,
  generateGuidPrefix,
  GuidPrefix,
  LoggerService,
  BuiltinEndpointSet,
  ChangeKind,
  Durability,
  EntityKind,
  SubMessageId,
  VendorId,
  HistoryAndDepth,
  ProtocolVersion,
  ReliabilityAndMaxBlockingTime,
  hasBuiltinEndpoint,
  Reliability,
  HistoryKind,
  Locator,
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
import { UserData, EndpointAttributes, Reader, Writer, livelinessPayload } from "./routing";
import { ReaderView } from "./routing/ReaderView";
import {
  UdpRemoteInfo,
  UdpSocket,
  UdpSocketCreate,
  discoveryMulticastPort,
  sendMessageToUdp,
  createMulticastUdpSocket,
  createUdpSocket,
  locatorForSocket,
} from "./transport";

export interface ParticipantEvents {
  error: (error: Error) => void;
  discoveredParticipant: (participant: ParticipantAttributes) => void;
  discoveredPublication: (endpoint: EndpointAttributes) => void;
  discoveredSubscription: (endpoint: EndpointAttributes) => void;
  userData: (userData: UserData) => void;
}

type SubscribeOpts = {
  topicName: string;
  typeName: string;
  durability: Durability;
  reliability: ReliabilityAndMaxBlockingTime;
  history: HistoryAndDepth;
};

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
  private readonly participants = new Map<string, ParticipantView>(); // guidPrefix -> ParticipantView
  private readonly readers = new Map<EntityId, Reader>();
  private readonly writers = new Map<EntityId, Writer>();
  private readonly readerIdToWriter = new Map<EntityId, Writer>();
  private readonly writerIdToReaders = new Map<EntityId, Reader[]>();
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

    const endpoints = builtinEndpoints;
    this.maybeAddReader(endpoints, BuiltinEndpointSet.ParticipantDetector, EntityIdBuiltin.ParticipantReader, EntityIdBuiltin.ParticipantWriter); // prettier-ignore
    this.maybeAddReader(endpoints, BuiltinEndpointSet.PublicationDetector, EntityIdBuiltin.PublicationsReader, EntityIdBuiltin.PublicationsWriter); // prettier-ignore
    this.maybeAddReader(endpoints, BuiltinEndpointSet.SubscriptionDetector, EntityIdBuiltin.SubscriptionsReader, EntityIdBuiltin.SubscriptionsWriter); // prettier-ignore
    this.maybeAddReader(endpoints, BuiltinEndpointSet.ParticipantMessageDataReader, EntityIdBuiltin.ParticipantMessageReader, EntityIdBuiltin.ParticipantMessageWriter); // prettier-ignore
    this.maybeAddWriter(endpoints, BuiltinEndpointSet.ParticipantAnnouncer, EntityIdBuiltin.ParticipantReader, EntityIdBuiltin.ParticipantWriter); // prettier-ignore
    this.maybeAddWriter(endpoints, BuiltinEndpointSet.PublicationAnnouncer, EntityIdBuiltin.PublicationsReader, EntityIdBuiltin.PublicationsWriter); // prettier-ignore
    this.maybeAddWriter(endpoints, BuiltinEndpointSet.SubscriptionAnnouncer, EntityIdBuiltin.SubscriptionsReader, EntityIdBuiltin.SubscriptionsWriter); // prettier-ignore
    this.maybeAddWriter(endpoints, BuiltinEndpointSet.ParticipantMessageDataWriter, EntityIdBuiltin.ParticipantMessageReader, EntityIdBuiltin.ParticipantMessageWriter); // prettier-ignore
  }

  async start(): Promise<void> {
    // TODO: Listen on all interfaces
    const address = this.addresses[0]!;
    this.log?.debug?.(`Starting participant ${this.name} on ${address}`);

    // Create the multicast UDP socket for discovering other participants and advertising ourself
    this.multicastSocket = await createMulticastUdpSocket(
      discoveryMulticastPort(this.attributes.domainId),
      this.udpSocketCreate,
      this._handleUdpMessage,
      this._handleError,
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
      this._handleUdpMessage,
      this._handleError,
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
      throw new Error(`Cannot send before unicast socket is bound`);
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
      const readers = participant.writerIdToReaders.get(writer.attributes.entityId);
      if (readers != undefined) {
        for (const reader of readers) {
          promises.push(
            this.sendChangesTo(reader, writer, participant.attributes.defaultUnicastLocatorList),
          );
        }
      }
    }
    await Promise.all(promises);
  }

  async sendChangesTo(reader: ReaderView, writer: Writer, locators: Locator[]): Promise<void> {
    if (this.unicastSocket == undefined) {
      // We're not running, so don't send anything
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

    const subscriptionId = this.nextEndpointId++;
    const readerEntityId = makeEntityId(subscriptionId, EntityKind.AppdefReaderNoKey);
    const endpointGuid = makeGuid(this.attributes.guidPrefix, readerEntityId);
    this.log?.info?.(
      `Creating subscription ${endpointGuid} to ${opts.topicName} (${opts.typeName})`,
    );

    // Parameter list
    const parameters = new Parameters();
    parameters.topicName(opts.topicName);
    parameters.typeName(opts.typeName);
    parameters.reliability(opts.reliability);
    parameters.history(opts.history);
    parameters.protocolVersion(this.attributes.protocolVersion);
    parameters.vendorId(this.attributes.vendorId);
    parameters.endpointGuid(endpointGuid);
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

  // async unsubscribe(): Promise<void> {}

  async advertiseParticipant(): Promise<void> {
    const writer = this.writers.get(EntityIdBuiltin.ParticipantWriter);
    if (writer == undefined) {
      throw new Error(`Cannot advertise participant without ParticipantWriter`);
    }

    // Parameter list
    const parameters = new Parameters();
    parameters.userDataString("enclave=/;");
    parameters.protocolVersion({ major: 2, minor: 1 });
    parameters.vendorId(VendorId.EclipseCycloneDDS);
    parameters.participantLeaseDuration({ sec: 10, nsec: 0 });
    parameters.participantGuid(makeGuid(this.attributes.guidPrefix, EntityIdBuiltin.Participant));
    parameters.builtinEndpointSet(builtinEndpoints);
    parameters.domainId(this.attributes.domainId);
    for (const locator of this.attributes.defaultUnicastLocatorList) {
      parameters.defaultUnicastLocator(locator);
    }
    for (const locator of this.attributes.metatrafficUnicastLocatorList) {
      parameters.defaultUnicastLocator(locator);
    }
    parameters.finish();

    writer.history.add({
      timestamp: fromDate(new Date()),
      kind: ChangeKind.Alive,
      writerGuid: makeGuid(this.attributes.guidPrefix, EntityIdBuiltin.ParticipantWriter),
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

    this.log?.debug?.(
      `ACKNACK to ${makeGuid(
        guidPrefix,
        writerEntityId,
      )}, first=${firstAvailableSeqNumber}, last=${lastSeqNumber}`,
    );

    // If the final flag is set and we have no missing sequence numbers, do not send an ACKNACK
    if (final && sequenceNumSet.empty()) {
      return;
    }

    // RTPS message
    const msg = new Message(this.attributes);
    msg.writeSubmessage(new InfoDst(guidPrefix));
    msg.writeSubmessage(
      new AckNack(readerEntityId, writerEntityId, sequenceNumSet, ++reader.count, final),
    );

    await sendMessageToUdp(msg, srcSocket, locators);
  }

  private maybeAddReader(
    endpointsAvailable: BuiltinEndpointSet,
    flag: BuiltinEndpointSet,
    readerEntityId: EntityId,
    writerEntityId: EntityId,
  ): void {
    if (!hasBuiltinEndpoint(endpointsAvailable, flag)) {
      return;
    }

    const reader = new Reader({
      guidPrefix: this.attributes.guidPrefix,
      entityId: readerEntityId,
      reliability: { kind: Reliability.Reliable, maxBlockingTime: fromMillis(100) },
      history: { kind: HistoryKind.KeepLast, depth: 0 },
      protocolVersion: this.attributes.protocolVersion,
      vendorId: this.attributes.vendorId,
    });

    this.readers.set(readerEntityId, reader);

    const readersForWriter = this.writerIdToReaders.get(writerEntityId) ?? [];
    readersForWriter.push(reader);
    this.writerIdToReaders.set(writerEntityId, readersForWriter);
  }

  private maybeAddWriter(
    endpointsAvailable: BuiltinEndpointSet,
    flag: BuiltinEndpointSet,
    readerEntityId: EntityId,
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

    this.readerIdToWriter.set(readerEntityId, writer);
  }

  private _handleError = (err: Error): void => {
    if (this.running) {
      this.log?.warn?.(`${this.toString()} error: ${err}`);
      this.emit("error", err);
    }
  };

  private _handleUdpMessage = (data: Uint8Array, rinfo: UdpRemoteInfo): void => {
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

  private _handleHeartbeat = (guidPrefix: GuidPrefix, heartbeat: HeartbeatView): void => {
    const srcSocket = this.unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const participant = this.participants.get(guidPrefix);
    if (participant == undefined) {
      this.log?.warn?.(`Received heartbeat from unknown participant ${guidPrefix}`);
      return;
    }

    const writerView = participant.writers.get(heartbeat.writerEntityId);
    if (writerView != undefined) {
      writerView.firstAvailableSeqNum = heartbeat.firstAvailableSeqNumber;
      writerView.lastSeqNum = heartbeat.lastSeqNumber;
    }

    const readers = this.writerIdToReaders.get(heartbeat.writerEntityId);
    if (readers == undefined) {
      this.log?.warn?.(`Received heartbeat from unknown writer ${heartbeat.writerEntityId}`);
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

  private _handleAckNack = (guidPrefix: GuidPrefix, ackNack: AckNackView): void => {
    const srcSocket = this.unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const participant = this.participants.get(guidPrefix);
    if (participant == undefined) {
      this.log?.warn?.(`Received acknack from unknown participant ${guidPrefix}`);
      return;
    }

    const readerView = participant.readers.get(ackNack.readerEntityId);
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

  private _handleDataMsg = (guidPrefix: GuidPrefix, dataMsg: DataMsgView): void => {
    const writerGuid = makeGuid(guidPrefix, dataMsg.writerEntityId);
    const timestamp = dataMsg.effectiveTimestamp ?? fromDate(new Date());
    const sequenceNumber = dataMsg.writerSeqNumber;
    const data = dataMsg.serializedData;

    // Get all of our readers for this writerId
    const readers = this.writerIdToReaders.get(dataMsg.writerEntityId);
    if (readers == undefined) {
      this.log?.warn?.(`Received data from unknown writer ${writerGuid}`);
      return;
    }

    this.log?.debug?.(`DATA: ${data.length} bytes (seq ${sequenceNumber}) from ${writerGuid}`);

    for (const reader of readers) {
      // Record this data message into the reader's history
      reader.history.add({
        timestamp,
        kind: ChangeKind.Alive,
        writerGuid,
        sequenceNumber,
        data,
      });

      switch (dataMsg.writerEntityId) {
        case EntityIdBuiltin.PublicationsWriter:
          this._handlePublication(dataMsg, timestamp);
          break;
        case EntityIdBuiltin.SubscriptionsWriter:
          this._handleSubscription(dataMsg, timestamp);
          break;
        case EntityIdBuiltin.ParticipantWriter:
          this._handleParticipant(guidPrefix, dataMsg, timestamp);
          break;
        case EntityIdBuiltin.ParticipantMessageWriter:
          this._handleParticipantMessage(guidPrefix, dataMsg, timestamp);
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

      // Send preemptive data and heartbeats to participant readers
      for (const readerView of participant.readers.values()) {
        const writer = this.readerIdToWriter.get(readerView.attributes.entityId);
        if (writer != undefined) {
          const locators = participant.attributes.defaultUnicastLocatorList;
          void this.sendChangesTo(readerView, writer, locators);
        }
      }

      // Send preemptive acknacks to participant writers
      for (const writerView of participant.writers.values()) {
        const readers = this.writerIdToReaders.get(writerView.attributes.entityId);
        if (readers != undefined) {
          const writerEntityId = writerView.attributes.entityId;
          const locators = participant.attributes.metatrafficUnicastLocatorList;
          for (const reader of readers) {
            void this.sendAckNackTo(
              reader,
              participantData.guidPrefix,
              writerEntityId,
              1n,
              0n,
              false,
              locators,
            );
          }
        }
      }
    } else {
      this.log?.info?.(`Updating participant ${participantData.guidPrefix}`);
      participant.update(participantData);
    }
  };

  private _handleParticipantMessage = (
    senderGuidPrefix: GuidPrefix,
    dataMsg: DataMsgView,
    _timestamp: Time | undefined,
  ): void => {
    // TODO: Handle this when we have a concept of participant alive/stale states
    this.log?.debug?.(
      `Received participant message from ${makeGuid(senderGuidPrefix, dataMsg.writerEntityId)}`,
    );
  };

  private _handlePublication = (dataMsg: DataMsgView, timestamp: Time | undefined): void => {
    const attributes = parseEndpoint(dataMsg.parameters(), timestamp);
    if (attributes == undefined) {
      this.log?.warn?.(`Failed to parse publication attributes from ${dataMsg.offset} byte DATA`);
      return;
    }

    const participant = this.participants.get(attributes.guidPrefix);
    if (participant == undefined) {
      this.log?.warn?.(`Received publication from unknown participant ${attributes.guidPrefix}`);
      return;
    }

    const guid = makeGuid(attributes.guidPrefix, attributes.entityId);
    if (participant.publications.has(attributes.entityId)) {
      this.log?.debug?.(
        `Updating publication ${attributes.topicName} (${attributes.typeName}) (${guid})`,
      );
    } else {
      this.log?.info?.(
        `Tracking publication ${attributes.topicName} (${attributes.typeName}) (${guid})`,
      );
    }

    // Update the map of publications for this participant
    participant.publications.set(attributes.entityId, attributes);

    // If a writer is being tracked for this publication, update it as well
    const writerView = participant.writers.get(attributes.entityId);
    if (writerView != undefined) {
      writerView.attributes = attributes;
    }

    this.emit("discoveredPublication", attributes);
  };

  private _handleSubscription = (dataMsg: DataMsgView, timestamp: Time | undefined): void => {
    const attributes = parseEndpoint(dataMsg.parameters(), timestamp);
    if (attributes == undefined) {
      this.log?.warn?.(`Failed to parse subscription attributes from ${dataMsg.offset} byte DATA`);
      return;
    }

    const participant = this.participants.get(attributes.guidPrefix);
    if (participant == undefined) {
      this.log?.warn?.(`Received subscription from unknown participant ${attributes.guidPrefix}`);
      return;
    }

    const guid = makeGuid(attributes.guidPrefix, attributes.entityId);
    if (participant.subscriptions.has(attributes.entityId)) {
      this.log?.debug?.(
        `Updating subscription ${attributes.topicName} (${attributes.typeName}) (${guid})`,
      );
      return;
    } else {
      this.log?.info?.(
        `Tracking subscription ${attributes.topicName} (${attributes.typeName}) (${guid})`,
      );
    }

    // Update the map of subscriptions for this participant
    participant.subscriptions.set(attributes.entityId, attributes);

    // If a reader is being tracked for this subscription, update it as well
    const readerView = participant.readers.get(attributes.entityId);
    if (readerView != undefined) {
      readerView.attributes = attributes;
    }

    this.emit("discoveredSubscription", attributes);
  };
}
