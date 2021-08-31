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
  fromHex,
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
  SequenceNumberSet,
  SubMessageId,
  uint32ToHex,
  VendorId,
} from "./common";
import { parseEndpoint, parseParticipant } from "./discovery";
import { CacheChange, EMPTY_DATA } from "./history";
import { Message, MessageView, Parameters } from "./messaging";
import {
  AckNack,
  AckNackFlags,
  AckNackView,
  DataFlags,
  DataMsg,
  DataMsgView,
  Gap,
  GapView,
  Heartbeat,
  HeartbeatFlags,
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
  unregisterPayload,
  UnregisterType,
  UserData,
  Writer,
  WriterView,
} from "./routing";
import {
  createMulticastUdpSocket,
  createUdpSocket,
  discoveryMulticastPort,
  locatorForSocket,
  locatorFromUdpAddress,
  MULTICAST_IPv4,
  sendMessageToUdp,
  UdpRemoteInfo,
  UdpSocket,
  UdpSocketCreate,
} from "./transport";

export type ParticipantTuning = {
  keepAliveMs?: number;
};

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

  private readonly _addresses: ReadonlyArray<string>;
  private readonly _udpSocketCreate: UdpSocketCreate;
  private readonly _log?: LoggerService;
  private readonly _participants = new Map<GuidPrefix, ParticipantView>();
  private readonly _writers = new Map<EntityId, Writer>();
  private readonly _subscriptions = new Map<EntityId, SubscribeOpts>();
  private _running = true;
  private _unicastSocket?: UdpSocket;
  private _multicastSocket?: UdpSocket;
  private _multicastLocator: Locator;
  private nextEndpointId = 1;
  private _receivedBytes = 0;
  private _keepAliveMs: number;
  private _keepAliveTimer?: ReturnType<typeof setTimeout>;

  get running(): boolean {
    return this._running;
  }

  get unicastSocket(): UdpSocket | undefined {
    return this._unicastSocket;
  }

  get multicastSocket(): UdpSocket | undefined {
    return this._multicastSocket;
  }

  get receivedBytes(): number {
    return this._receivedBytes;
  }

  constructor(options: {
    name: string;
    addresses: string[];
    domainId?: number;
    guidPrefix?: GuidPrefix;
    udpSocketCreate: UdpSocketCreate;
    log?: LoggerService;
    protocolVersion?: ProtocolVersion;
    vendorId?: VendorId;
    tuning?: ParticipantTuning;
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

    if (fromHex(this.attributes.guidPrefix).length !== 12) {
      throw new Error(`invalid guidPrefix "${this.attributes.guidPrefix}", must be 12 byte hex`);
    }

    const tuning = options.tuning ?? {};
    this._keepAliveMs = tuning.keepAliveMs ?? 4000;

    this._addresses = options.addresses;
    this._udpSocketCreate = options.udpSocketCreate;
    this._log = options.log;
    this._multicastLocator = locatorFromUdpAddress({
      address: MULTICAST_IPv4,
      family: "IPv4",
      port: discoveryMulticastPort(this.attributes.domainId),
    });

    const endpoints = this.attributes.availableBuiltinEndpoints;
    this.addBuiltinWriter(endpoints, BuiltinEndpointSet.ParticipantAnnouncer, EntityIdBuiltin.ParticipantWriter); // prettier-ignore
    this.addBuiltinWriter(endpoints, BuiltinEndpointSet.PublicationAnnouncer, EntityIdBuiltin.PublicationsWriter); // prettier-ignore
    this.addBuiltinWriter(endpoints, BuiltinEndpointSet.SubscriptionAnnouncer, EntityIdBuiltin.SubscriptionsWriter); // prettier-ignore
    this.addBuiltinWriter(endpoints, BuiltinEndpointSet.ParticipantMessageDataWriter, EntityIdBuiltin.ParticipantMessageWriter); // prettier-ignore
  }

  async start(): Promise<void> {
    if (!this.running) {
      throw new Error(`partipant ${this.attributes.guidPrefix} cannot start after shutdown`);
    }
    if (this._multicastSocket != undefined) {
      throw new Error(`participant ${this.attributes.guidPrefix} was already started`);
    }

    // TODO: Listen on all interfaces
    const address = this._addresses[0]!;
    this._log?.debug?.(`starting participant ${this.name} on ${address}`);

    // Create the multicast UDP socket for discovering other participants and advertising ourself
    this._multicastSocket = await createMulticastUdpSocket(
      discoveryMulticastPort(this.attributes.domainId),
      this._udpSocketCreate,
      this.handleUdpMessage,
      this.handleError,
    );
    const multiAddr = await this._multicastSocket.localAddress();
    if (multiAddr != undefined) {
      this._log?.debug?.(`listening on UDP multicast ${multiAddr?.address}:${multiAddr?.port}`);
    } else {
      this._log?.warn?.(`failed to bind UDP multicast socket to ${address}`);
    }

    // Create the unicast UDP socket for sending and receiving directly to participants
    this._unicastSocket = await createUdpSocket(
      address,
      this._udpSocketCreate,
      this.handleUdpMessage,
      this.handleError,
    );
    const locator = await locatorForSocket(this._unicastSocket);
    if (locator != undefined) {
      this._log?.debug?.(`listening on UDP ${locator.address}:${locator.port}`);
      this.attributes.defaultUnicastLocatorList = [locator];
      this.attributes.metatrafficUnicastLocatorList = [locator];
    } else {
      this._log?.warn?.(`failed to bind UDP socket to ${address}`);
    }

    // Record an advertisement for ourself in the ParticipantWriter history
    await this.advertiseParticipant(this.attributes);

    // Send our participant advertisement to multicast
    await this.broadcastParticipant(this.attributes);

    if (this._keepAliveMs > 0) {
      this._keepAliveTimer = setInterval(() => void this.sendAlive(), this._keepAliveMs);
    }
  }

  async shutdown(): Promise<void> {
    this._log?.debug?.("shutting down");
    this._running = false;
    if (this._keepAliveTimer != undefined) {
      clearTimeout(this._keepAliveTimer);
      this._keepAliveTimer = undefined;
    }
    this.removeAllListeners();

    try {
      await this.unadvertiseParticipant(this.attributes.guidPrefix);
    } catch (err) {
      this._log?.warn?.(`failed to unadvertise participant: ${err}`);
    }

    this._participants.clear();
    this._writers.clear();
    this._subscriptions.clear();

    this._multicastSocket?.close();
    this._unicastSocket?.close();
    this.attributes.defaultUnicastLocatorList = [];
    this.attributes.defaultMulticastLocatorList = [];
    this.attributes.metatrafficUnicastLocatorList = [];
    this.attributes.metatrafficMulticastLocatorList = [];
  }

  async sendAlive(manual?: boolean): Promise<void> {
    const srcSocket = this._unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const writer = this._writers.get(EntityIdBuiltin.ParticipantMessageWriter);
    if (writer == undefined) {
      return;
    }

    const writerGuid = makeGuid(
      this.attributes.guidPrefix,
      EntityIdBuiltin.ParticipantMessageWriter,
    );
    writer.history.set({
      timestamp: fromDate(new Date()),
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: writer.history.nextSequenceNum(),
      data: livelinessPayload(this.attributes.guidPrefix, manual ?? false),
      instanceHandle: writerGuid,
    });

    await this.sendChanges(writer);
  }

  async sendChanges(writer: Writer): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const participant of this._participants.values()) {
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
    const srcSocket = this._unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    // The reader sequence number set tells us which messages the reader is aware of but hasn't
    // received
    const changes: CacheChange[] = [];
    for (const seqNum of reader.readerSNState.sequenceNumbers()) {
      const change = writer.history.get(seqNum);
      if (change != undefined) {
        changes.push(change);
      }
    }

    // Send any additional messages the reader is not yet aware of
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

    // Append DATA messages
    let curTime: Time = { sec: -1, nsec: 0 };
    for (const change of changes) {
      // Write an INFO_TS (timestamp) submessage if necessary
      if (!areEqual(curTime, change.timestamp)) {
        msg.writeSubmessage(new InfoTs(change.timestamp));
        curTime = change.timestamp;
      }

      if (change.kind === ChangeKind.Alive || change.data.length > 0) {
        // Write this DATA submessage
        msg.writeSubmessage(
          new DataMsg(
            readerEntityId,
            writerEntityId,
            change.sequenceNumber,
            change.data,
            change.kind === ChangeKind.Alive
              ? DataFlags.DataPresent
              : DataFlags.InlineQoS | DataFlags.SerializedKey,
          ),
        );
      } else {
        // Write a GAP submessage
        msg.writeSubmessage(
          new Gap(
            readerEntityId,
            writerEntityId,
            change.sequenceNumber,
            new SequenceNumberSet(change.sequenceNumber + 1n, 0),
          ),
        );
      }
    }

    // Append a HEARTBEAT message
    const firstSeq = writer.history.getSequenceNumMin() ?? 1n;
    const lastSeq = writer.history.getSequenceNumMax() ?? 0n;
    msg.writeSubmessage(
      new Heartbeat(
        readerEntityId,
        writerEntityId,
        firstSeq,
        lastSeq,
        ++reader.count,
        HeartbeatFlags.Final,
      ),
    );

    // Send this message as a UDP packet
    this._log?.debug?.(
      `sending ${changes.length} change(s) (${msg.size} bytes), reader=${uint32ToHex(
        readerEntityId,
      )}, writer=${uint32ToHex(writerEntityId)}`,
    );
    await sendMessageToUdp(msg, srcSocket, locators);
  }

  subscribe(opts: SubscribeOpts): EntityId {
    const writer = this._writers.get(EntityIdBuiltin.SubscriptionsWriter);
    if (writer == undefined) {
      throw new Error(`cannot subscribe without SubscriptionsWriter`);
    }

    // Create a reader entityId/Guid for this subscription
    const subscriptionId = this.nextEndpointId++;
    const readerEntityId = makeEntityId(subscriptionId, EntityKind.AppdefReaderNoKey);
    const readerGuid = makeGuid(this.attributes.guidPrefix, readerEntityId);

    this._log?.info?.(
      `creating subscription ${readerGuid} for ${opts.topicName} (${opts.typeName})`,
    );
    this._subscriptions.set(readerEntityId, opts);

    // Match this subscription against existing writers (published topics)
    const local = this.attributes;
    for (const participant of this._participants.values()) {
      for (const writerEntityId of participant.remoteWriters.keys()) {
        matchLocalSubscription(local, readerEntityId, writerEntityId, opts, participant, this._log);
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

    writer.history.set({
      timestamp: fromDate(new Date()),
      kind: ChangeKind.Alive,
      writerGuid: makeGuid(this.attributes.guidPrefix, EntityIdBuiltin.SubscriptionsWriter),
      sequenceNumber: writer.history.nextSequenceNum(),
      data: parameters.data,
      instanceHandle: readerGuid,
    });

    void this.sendChanges(writer);

    return readerEntityId;
  }

  unsubscribe(readerEntityId: EntityId): boolean {
    const writer = this._writers.get(EntityIdBuiltin.SubscriptionsWriter);
    if (writer == undefined) {
      throw new Error(`cannot unsubscribe without SubscriptionsWriter`);
    }

    const opts = this._subscriptions.get(readerEntityId);
    if (opts == undefined) {
      this._log?.warn?.(`subscription not found for ${readerEntityId}`);
      return false;
    }

    const readerGuid = makeGuid(this.attributes.guidPrefix, readerEntityId);
    this._log?.info?.(`unsubscribing ${readerGuid} from ${opts.topicName} (${opts.typeName})`);

    // Remove the local copy of subscription options so new readers are not created
    this._subscriptions.delete(readerEntityId);

    // Remove any readers created for this subscription
    for (const participant of this._participants.values()) {
      participant.localReaders.delete(readerEntityId);
      const remoteWriterId = participant.localReaderIdToRemoteWriterId.get(readerEntityId);
      if (remoteWriterId != undefined) {
        participant.localReaderIdToRemoteWriterId.delete(readerEntityId);
        const readerIds = participant.remoteWriterIdToLocalReaderIds.get(remoteWriterId);
        const newReaderIds = readerIds?.filter((id) => id !== readerEntityId);
        if (newReaderIds == undefined || newReaderIds.length === 0) {
          participant.remoteWriterIdToLocalReaderIds.delete(remoteWriterId);
        } else {
          participant.remoteWriterIdToLocalReaderIds.set(remoteWriterId, newReaderIds);
        }
      }
    }

    writer.history.set({
      timestamp: fromDate(new Date()),
      kind: ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered,
      writerGuid: makeGuid(this.attributes.guidPrefix, EntityIdBuiltin.SubscriptionsWriter),
      sequenceNumber: writer.history.nextSequenceNum(),
      data: unregisterPayload(UnregisterType.Endpoint, readerGuid),
      instanceHandle: readerGuid,
    });

    void this.sendChanges(writer);

    return true;
  }

  async advertiseParticipant(attributes: ParticipantAttributes): Promise<void> {
    const writer = this._writers.get(EntityIdBuiltin.ParticipantWriter);
    if (writer == undefined) {
      throw new Error(`cannot advertise participant without ParticipantWriter`);
    }

    const participantGuid = makeGuid(attributes.guidPrefix, EntityIdBuiltin.Participant);

    // Parameter list
    const parameters = new Parameters();
    parameters.userDataString("enclave=/;");
    parameters.protocolVersion(attributes.protocolVersion);
    parameters.vendorId(attributes.vendorId);
    parameters.participantLeaseDuration(attributes.leaseDuration);
    parameters.participantGuid(participantGuid);
    parameters.builtinEndpointSet(attributes.availableBuiltinEndpoints);
    parameters.domainId(attributes.domainId);
    for (const locator of attributes.defaultUnicastLocatorList) {
      parameters.defaultUnicastLocator(locator);
    }
    for (const locator of attributes.metatrafficUnicastLocatorList) {
      parameters.metatrafficUnicastLocator(locator);
    }
    parameters.finish();

    writer.history.set({
      timestamp: fromDate(new Date()),
      kind: ChangeKind.Alive,
      writerGuid: makeGuid(attributes.guidPrefix, EntityIdBuiltin.ParticipantWriter),
      sequenceNumber: writer.history.nextSequenceNum(),
      data: parameters.data,
      instanceHandle: participantGuid,
    });

    await this.sendChanges(writer);
  }

  async broadcastParticipant(attributes: ParticipantAttributes): Promise<void> {
    const srcSocket = this._multicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const writer = this._writers.get(EntityIdBuiltin.ParticipantWriter);
    if (writer == undefined) {
      return;
    }

    const participantGuid = makeGuid(attributes.guidPrefix, EntityIdBuiltin.Participant);
    const change = writer.history.getByHandle(participantGuid);
    if (change == undefined || change.kind !== ChangeKind.Alive) {
      this._log?.warn?.(
        `cannot broadcast participant ${attributes.guidPrefix}, not found in ParticipantWriter history`,
      );
      return;
    }

    const msg = new Message(this.attributes);
    msg.writeSubmessage(new InfoTs(change.timestamp));
    msg.writeSubmessage(
      new DataMsg(
        EntityIdBuiltin.Unknown,
        EntityIdBuiltin.ParticipantWriter,
        change.sequenceNumber,
        change.data,
        DataFlags.DataPresent,
      ),
    );

    this._log?.debug?.(`broadcasting participant ${attributes.guidPrefix} to multicast`);
    await sendMessageToUdp(msg, srcSocket, [this._multicastLocator]);
  }

  async unadvertiseParticipant(guidPrefix: GuidPrefix): Promise<void> {
    const writer = this._writers.get(EntityIdBuiltin.ParticipantWriter);
    if (writer == undefined) {
      throw new Error(`cannot unadvertise participant without ParticipantWriter`);
    }

    const participantGuid = makeGuid(guidPrefix, EntityIdBuiltin.Participant);

    writer.history.set({
      timestamp: fromDate(new Date()),
      kind: ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered,
      writerGuid: makeGuid(this.attributes.guidPrefix, EntityIdBuiltin.SubscriptionsWriter),
      sequenceNumber: writer.history.nextSequenceNum(),
      data: unregisterPayload(UnregisterType.Participant, participantGuid),
      instanceHandle: participantGuid,
    });

    this._log?.debug?.(`unadvertising participant ${guidPrefix}`);
    await this.sendChanges(writer);
  }

  topicWriters(): EndpointAttributes[] {
    const endpoints: EndpointAttributes[] = [];
    for (const participant of this._participants.values()) {
      for (const writer of participant.remoteWriters.values()) {
        if (writer.attributes.topicName != undefined) {
          endpoints.push(writer.attributes);
        }
      }
    }
    return endpoints;
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
    const srcSocket = this._unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const readerEntityId = reader.attributes.entityId;
    const sequenceNumSet = reader.history.heartbeatUpdate(firstAvailableSeqNumber, lastSeqNumber);

    // If the final flag is set and we have no missing sequence numbers, do not send an ACKNACK
    if (final && sequenceNumSet.empty()) {
      return;
    }

    // RTPS message
    const msg = new Message(this.attributes);
    msg.writeSubmessage(new InfoDst(guidPrefix));
    msg.writeSubmessage(
      new AckNack(
        readerEntityId,
        writerEntityId,
        sequenceNumSet,
        ++reader.count,
        final ? AckNackFlags.Final : 0,
      ),
    );

    this._log?.debug?.(
      `sending ACKNACK to ${makeGuid(guidPrefix, writerEntityId)}, ${sequenceNumSet.toString()}`,
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
      history: { kind: HistoryKind.KeepLast, depth: 1 },
      protocolVersion: this.attributes.protocolVersion,
      vendorId: this.attributes.vendorId,
    });
    this._writers.set(writerEntityId, writer);
  }

  private getReaders(readerEntityId: EntityId, writerGuid: Guid): Reader[] {
    const [guidPrefix, writerEntityId] = guidParts(writerGuid);
    const participant = this._participants.get(guidPrefix);
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
    if (this._running) {
      this._log?.warn?.(`${this.toString()} error: ${err}`);
      this.emit("error", err);
    }
  };

  private handleUdpMessage = (data: Uint8Array, rinfo: UdpRemoteInfo): void => {
    const message = new MessageView(data);
    const version = message.protocolVersion;
    if (version.major !== 2) {
      const { major, minor } = version;
      this._log?.debug?.(`received message with unsupported protocol ${major}.${minor}`);
      return;
    }

    if (message.guidPrefix === this.attributes.guidPrefix) {
      // This is our own message
      return;
    }

    this._log?.debug?.(`received ${data.length} byte message from ${rinfo.address}:${rinfo.port}`);
    this._receivedBytes += data.length;

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
      } else if (msg.submessageId === SubMessageId.GAP) {
        this.handleGap(message.guidPrefix, msg as GapView);
      }
    }
  };

  private handleHeartbeat = (guidPrefix: GuidPrefix, heartbeat: HeartbeatView): void => {
    this._log?.debug?.(
      `  [SUBMSG] HEARTBEAT reader=${uint32ToHex(heartbeat.readerEntityId)} writer=${uint32ToHex(
        heartbeat.writerEntityId,
      )} ${heartbeat.firstAvailableSeqNumber},${heartbeat.lastSeqNumber} (count=${
        heartbeat.count
      }, liveliness=${heartbeat.liveliness}, final=${heartbeat.final})`,
    );

    const srcSocket = this._unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const participant = this._participants.get(guidPrefix);
    if (participant == undefined) {
      this._log?.warn?.(`received heartbeat from unknown participant ${guidPrefix}`);
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
      this._log?.warn?.(
        `received unrecognized heartbeat reader=${heartbeat.readerEntityId}, writer=${writerGuid}`,
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

  private handleGap = (guidPrefix: GuidPrefix, gap: GapView): void => {
    const timestamp = gap.effectiveTimestamp ?? fromDate(new Date());
    const readerEntityId = gap.readerEntityId;
    const writerEntityId = gap.writerEntityId;
    const writerGuid = makeGuid(guidPrefix, writerEntityId);
    const gapStart = gap.gapStart;
    const gapList = gap.gapList;
    const gapEnd = gapList.base - 1n;

    this._log?.debug?.(
      `  [SUBMSG] GAP reader=${uint32ToHex(readerEntityId)} writer=${uint32ToHex(
        writerEntityId,
      )} gapStart=${gapStart}, gapEnd=${gapEnd}, list=${gapList.toString()}`,
    );

    const srcSocket = this._unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    // Get all of our readers for this writer
    const readers = this.getReaders(readerEntityId, writerGuid);
    for (const reader of readers) {
      // Record these gaps into the reader's history
      reader.history.addGapRange(gapStart, gapEnd, timestamp, writerGuid);
      for (const sequenceNumber of gapList.sequenceNumbers()) {
        reader.history.set({
          timestamp,
          kind: ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered,
          writerGuid,
          sequenceNumber,
          data: EMPTY_DATA,
          instanceHandle: undefined,
        });
      }
    }
  };

  private handleAckNack = (guidPrefix: GuidPrefix, ackNack: AckNackView): void => {
    this._log?.debug?.(
      `  [SUBMSG] ACKNACK reader=${uint32ToHex(ackNack.readerEntityId)} writer=${uint32ToHex(
        ackNack.writerEntityId,
      )} ${ackNack.readerSNState.toString()}`,
    );

    const srcSocket = this._unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const participant = this._participants.get(guidPrefix);
    if (participant == undefined) {
      this._log?.warn?.(`received acknack from unknown participant ${guidPrefix}`);
      return;
    }

    const readerView = participant.remoteReaders.get(ackNack.readerEntityId);
    if (readerView == undefined) {
      this._log?.warn?.(`received acknack for unknown reader ${ackNack.readerEntityId}`);
      return;
    }

    readerView.readerSNState = ackNack.readerSNState;

    const writer = this._writers.get(ackNack.writerEntityId);
    if (writer == undefined) {
      this._log?.warn?.(`received acknack for unknown writer ${ackNack.writerEntityId}`);
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
    this._log?.debug?.(
      `  [SUBMSG] DATA reader=${uint32ToHex(dataMsg.readerEntityId)} writer=${uint32ToHex(
        dataMsg.writerEntityId,
      )} ${data.length} bytes (seq ${sequenceNumber}) from ${writerGuid}, ${
        readers.length
      } reader(s)`,
    );

    let instanceHandle: Guid | undefined;
    switch (dataMsg.writerEntityId) {
      case EntityIdBuiltin.PublicationsWriter:
        instanceHandle = this.handlePublication(dataMsg, timestamp);
        break;
      case EntityIdBuiltin.SubscriptionsWriter:
        instanceHandle = this.handleSubscription(dataMsg, timestamp);
        break;
      case EntityIdBuiltin.ParticipantWriter:
        instanceHandle = this.handleParticipant(guidPrefix, dataMsg, timestamp);
        break;
      case EntityIdBuiltin.ParticipantMessageWriter:
        instanceHandle = this.handleParticipantMessage(guidPrefix, dataMsg, timestamp);
        break;
      case EntityIdBuiltin.TypeLookupRequestWriter:
        this._log?.warn?.(`received type lookup request from ${guidPrefix}`);
        break;
      case EntityIdBuiltin.TypeLookupReplyWriter:
        this._log?.warn?.(`received type lookup reply from ${guidPrefix}`);
        break;
      default:
        instanceHandle = this.handleUserData(guidPrefix, dataMsg, timestamp, readers);
        break;
    }

    for (const reader of readers) {
      // Record this data message into the reader's history
      reader.history.set({
        timestamp,
        kind: ChangeKind.Alive,
        writerGuid,
        sequenceNumber,
        data,
        instanceHandle,
      });
    }
  };

  private async sendInitialHeartbeats(participant: ParticipantView): Promise<void> {
    const srcSocket = this._unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const msg = new Message(this.attributes);
    msg.writeSubmessage(new InfoDst(participant.attributes.guidPrefix));

    for (const writer of this._writers.values()) {
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
            HeartbeatFlags.Final,
          ),
        );
      }
    }

    // Send this message as a UDP packet
    this._log?.debug?.(
      `sending ${msg.size} byte initial heartbeat message to ${participant.attributes.guidPrefix}`,
    );
    await sendMessageToUdp(msg, srcSocket, participant.attributes.metatrafficUnicastLocatorList);
  }

  private handleParticipant = (
    senderGuidPrefix: GuidPrefix,
    dataMsg: DataMsgView,
    timestamp: Time | undefined,
  ): Guid | undefined => {
    const params = dataMsg.parameters();
    if (params == undefined) {
      this._log?.warn?.(`ignoring participant message with no parameters from ${senderGuidPrefix}`);
      return undefined;
    }

    const participantData = parseParticipant(params, timestamp);
    if (participantData == undefined) {
      this._log?.warn?.(`failed to parse participant data from ${senderGuidPrefix}`);
      return undefined;
    }

    const guidPrefix = participantData.guidPrefix;
    const guid = makeGuid(guidPrefix, EntityIdBuiltin.Participant);

    let participant = this._participants.get(guidPrefix);
    if (participant == undefined) {
      this._log?.info?.(`tracking participant ${guidPrefix}`);
      participant = new ParticipantView(this, participantData);
      this._participants.set(guidPrefix, participant);
      this.emit("discoveredParticipant", participantData);

      // Send our participant advertisement(s) to this other participant
      const writer = this._writers.get(EntityIdBuiltin.ParticipantWriter);
      if (writer != undefined) {
        const readers = participant.remoteReadersForWriterId(EntityIdBuiltin.ParticipantWriter);
        for (const reader of readers) {
          void this.sendChangesTo(reader, writer, participant.attributes.defaultUnicastLocatorList);
        }
      }

      // Send preemptive heartbeats for participant readers
      void this.sendInitialHeartbeats(participant);
    } else {
      this._log?.info?.(`updating participant ${guidPrefix}`);
      participant.update(participantData);
    }

    return guid;
  };

  private handleParticipantMessage = (
    senderGuidPrefix: GuidPrefix,
    dataMsg: DataMsgView,
    _timestamp: Time | undefined,
  ): Guid | undefined => {
    const guidPrefix = dataMsg.participantMessageData();
    if (guidPrefix == undefined) {
      this._log?.warn?.(`failed to parse participant message data from ${senderGuidPrefix}`);
      return undefined;
    }

    const guid = makeGuid(guidPrefix, EntityIdBuiltin.Participant);

    this._log?.debug?.(
      `received participant message from ${makeGuid(
        senderGuidPrefix,
        dataMsg.writerEntityId,
      )} for ${guid}`,
    );

    // TODO: Handle this when we have a concept of participant alive/stale states

    return guid;
  };

  private handleUserData = (
    senderGuidPrefix: GuidPrefix,
    dataMsg: DataMsgView,
    timestamp: Time | undefined,
    readers: Reader[],
  ): undefined => {
    const participant = this._participants.get(senderGuidPrefix);
    if (participant == undefined) {
      this._log?.warn?.(`received user data from unknown participant ${senderGuidPrefix}`);
      return undefined;
    }

    const writerView = participant.remoteWriters.get(dataMsg.writerEntityId);
    if (writerView == undefined) {
      this._log?.warn?.(
        `received user data from unknown writer ${uint32ToHex(dataMsg.writerEntityId)}`,
      );
      return undefined;
    }

    if (readers.length === 0) {
      this._log?.warn?.(
        `received user data from writer ${uint32ToHex(dataMsg.writerEntityId)} with no readers`,
      );
      return undefined;
    }

    for (const reader of readers) {
      this.emit("userData", {
        timestamp,
        publication: writerView.attributes,
        subscription: reader.attributes,
        writerSeqNumber: dataMsg.writerSeqNumber,
        serializedData: dataMsg.serializedData,
      });
    }

    return undefined;
  };

  private handlePublication = (
    dataMsg: DataMsgView,
    timestamp: Time | undefined,
  ): Guid | undefined => {
    const attributes = parseEndpoint(dataMsg.parameters(), timestamp);
    if (attributes == undefined) {
      this._log?.warn?.(
        `failed to parse publication attributes from ${dataMsg.serializedData.length} byte DATA`,
      );
      return undefined;
    }

    const writerEntityId = attributes.entityId;
    const guid = makeGuid(attributes.guidPrefix, writerEntityId);
    this._log?.debug?.(`PUB: ${guid}`);

    const participant = this._participants.get(attributes.guidPrefix);
    if (participant == undefined) {
      this._log?.warn?.(`received publication from unknown participant ${attributes.guidPrefix}`);
      return guid;
    }

    if (!participant.remoteWriters.has(writerEntityId)) {
      this._log?.info?.(
        `tracking publication ${attributes.topicName} (${attributes.typeName}) (${guid})`,
      );
    }

    // Create or update a WriterView for this publication
    let writerView = participant.remoteWriters.get(writerEntityId);
    if (writerView == undefined) {
      writerView = new WriterView(attributes);
      participant.remoteWriters.set(writerEntityId, writerView);

      const local = this.attributes;
      for (const [readerEntityId, opts] of this._subscriptions.entries()) {
        matchLocalSubscription(local, readerEntityId, writerEntityId, opts, participant, this._log);
      }
    } else {
      writerView.attributes = attributes;
    }

    this.emit("discoveredPublication", attributes);
    return guid;
  };

  private handleSubscription = (
    dataMsg: DataMsgView,
    timestamp: Time | undefined,
  ): Guid | undefined => {
    const attributes = parseEndpoint(dataMsg.parameters(), timestamp);
    if (attributes == undefined) {
      this._log?.warn?.(`failed to parse subscription attributes from ${dataMsg.offset} byte DATA`);
      return undefined;
    }

    const guid = makeGuid(attributes.guidPrefix, attributes.entityId);
    this._log?.debug?.(`SUB: ${guid}`);

    const participant = this._participants.get(attributes.guidPrefix);
    if (participant == undefined) {
      this._log?.warn?.(`received subscription from unknown participant ${attributes.guidPrefix}`);
      return guid;
    }

    if (!participant.remoteReaders.has(attributes.entityId)) {
      this._log?.info?.(
        `tracking subscription ${attributes.topicName} (${attributes.typeName}) (${guid})`,
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
    return guid;
  };
}
