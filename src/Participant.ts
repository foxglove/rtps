import { CdrReader } from "@foxglove/cdr";
import { areEqual, fromDate, fromMillis, Time } from "@foxglove/rostime";
import { EventEmitter } from "eventemitter3";

import { ParticipantAttributes } from "./ParticipantAttributes";
import { ParticipantView } from "./ParticipantView";
import {
  BuiltinEndpointSet,
  ChangeKind,
  Durability,
  EntityId,
  EntityIdBuiltin,
  EntityKind,
  FragmentNumberSet,
  fromHex,
  generateGuidPrefix,
  Guid,
  guidParts,
  GuidPrefix,
  guidPrefixFromCDR,
  hasBuiltinEndpoint,
  HistoryKind,
  Locator,
  LoggerService,
  makeEntityId,
  makeGuid,
  ProtocolVersion,
  Reliability,
  SequenceNumber,
  SequenceNumberSet,
  SubMessageId,
  uint32ToHex,
  VendorId,
} from "./common";
import { parseEndpoint, parseParticipant } from "./discovery";
import { CacheChange, EMPTY_DATA } from "./history";
import { Message, MessageView, Parameters, ParametersView } from "./messaging";
import {
  AckNack,
  AckNackFlags,
  AckNackView,
  DataFlags,
  DataFragView,
  DataMsg,
  DataMsgView,
  Gap,
  GapView,
  Heartbeat,
  HeartbeatFlags,
  HeartbeatFragView,
  HeartbeatView,
  InfoDst,
  InfoTs,
  NackFrag,
  NackFragView,
} from "./messaging/submessages";
import {
  DataFragments,
  EndpointAttributes,
  EndpointAttributesWithTopic,
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
  locatorFromUdpAddress,
  MULTICAST_IPv4,
  sendMessageToUdp,
  UdpRemoteInfo,
  UdpSocket,
  UdpSocketCreate,
  UdpSocketOptions,
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
  private readonly _udpSocketOptions: UdpSocketOptions | undefined;
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
    udpSocketOptions?: UdpSocketOptions;
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
    this._udpSocketOptions = options.udpSocketOptions;
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
      this._udpSocketOptions,
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
      undefined,
      this._udpSocketCreate,
      this._udpSocketOptions,
      this.handleUdpMessage,
      this.handleError,
    );
    const listenAddr = await this._unicastSocket.localAddress();
    if (listenAddr != undefined) {
      const locator = locatorFromUdpAddress({ address, family: "IPv4", port: listenAddr.port });
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

    void this._multicastSocket?.close();
    void this._unicastSocket?.close();
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

    await this.sendMetatrafficChanges(writer);
  }

  async sendDefaultChanges(writer: Writer): Promise<void> {
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

  async sendMetatrafficChanges(writer: Writer): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const participant of this._participants.values()) {
      const readers = participant.remoteReadersForWriterId(writer.attributes.entityId);
      for (const reader of readers) {
        promises.push(
          this.sendChangesTo(reader, writer, participant.attributes.metatrafficUnicastLocatorList),
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

    this._log?.debug?.(
      `sending ${changes.length} change(s) (${msg.size} bytes), reader=${this.readerName(
        readerEntityId,
      )}, writer=${this.writerName(writerEntityId)}`,
    );

    // Send this message as a UDP packet
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
    parameters.durability(opts.durability);
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

    void this.sendMetatrafficChanges(writer);

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

    void this.sendMetatrafficChanges(writer);

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

    await this.sendMetatrafficChanges(writer);
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
    await this.sendMetatrafficChanges(writer);
  }

  topicWriters(): EndpointAttributesWithTopic[] {
    const endpoints: EndpointAttributesWithTopic[] = [];
    for (const participant of this._participants.values()) {
      for (const writer of participant.remoteWriters.values()) {
        if (writer.attributes.topicName != undefined && writer.attributes.typeName != undefined) {
          endpoints.push(writer.attributes as EndpointAttributesWithTopic);
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
    const participant = this._participants.get(guidPrefix);
    if (participant == undefined) {
      return;
    }

    // Check if we are missing fragments for any of the sequence numbers
    let endSeq = firstAvailableSeqNumber;
    for (endSeq = firstAvailableSeqNumber; endSeq <= lastSeqNumber; endSeq++) {
      const fragments = participant.tryGetFragments(writerEntityId, endSeq);
      if (fragments != undefined) {
        // We are missing one or more fragments for this sequence number. We
        // can't positively or negatively acknowledge this seqnum, so instead
        // send a NackFrag for it and make sure our AckNack sequence set ends
        // before this seqnum
        void this.sendNackFragTo(
          guidPrefix,
          fragments.fragmentCount,
          readerEntityId,
          writerEntityId,
          endSeq,
          fragments,
          locators,
        );
        endSeq--;
        break;
      }
    }

    if (endSeq < firstAvailableSeqNumber) {
      // No sequence numbers need AckNack (only sending NackFrag)
      return;
    }

    const sequenceNumSet = reader.history.heartbeatUpdate(firstAvailableSeqNumber, endSeq);

    // If there are no sequence numbers to acknowledge, do not send an ACKNACK.
    // Doing so will enter an infinite loop with FastRTPS
    if (sequenceNumSet.base === 0n) {
      return;
    }
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

  private async sendNackFragTo(
    guidPrefix: GuidPrefix,
    heartbeatFrag: HeartbeatFragView,
    fragmentTracker: DataFragments,
    locators: Locator[],
  ): Promise<void> {
    const srcSocket = this._unicastSocket;
    if (srcSocket == undefined) {
      return;
    }

    const missing = Array.from(fragmentTracker.missingFragments());
    const base = missing[0] ?? 1;
    const numBits = heartbeatFrag.lastFragmentNumber - base;
    const state = new FragmentNumberSet(base, numBits);
    for (const idx of missing) {
      const fragmentNum = idx + 1;
      if (fragmentNum > heartbeatFrag.lastFragmentNumber) {
        break;
      }
      state.add(fragmentNum);
    }

    // RTPS message
    const msg = new Message(this.attributes);
    msg.writeSubmessage(new InfoDst(guidPrefix));
    msg.writeSubmessage(
      new NackFrag(
        heartbeatFrag.readerEntityId,
        heartbeatFrag.writerEntityId,
        heartbeatFrag.writerSeqNumber,
        state,
        ++fragmentTracker.count,
      ),
    );

    this._log?.debug?.(
      `sending NACK_FRAG to ${makeGuid(
        guidPrefix,
        heartbeatFrag.writerEntityId,
      )}, ${state.toString()}`,
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
      durability: Durability.TransientLocal,
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

  private readerName(readerEntityId: EntityId): string {
    const name =
      this._subscriptions.get(readerEntityId)?.topicName ??
      EntityIdBuiltin[readerEntityId] ??
      EntityKind[readerEntityId & 0xff] ??
      "(unknown)";
    return `${name} [${uint32ToHex(readerEntityId)}]`;
  }

  private writerName(writerEntityId: EntityId): string {
    const name =
      EntityIdBuiltin[writerEntityId] ?? EntityKind[writerEntityId & 0xff] ?? "(unknown)";
    return `${name} [${uint32ToHex(writerEntityId)}]`;
  }

  private handleError = (err: Error): void => {
    if (this._running) {
      this._log?.warn?.(`[ERROR][${this.name}] ${err}`);
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

      try {
        switch (msg.submessageId) {
          case SubMessageId.INFO_TS: {
            // INFO_TS is already handled by setting effectiveTimestamp on other submessages
            const infoTs = msg as InfoTsView;
            this._log?.debug?.(`  [SUBMSG] INFO_TS ${toNanoSec(infoTs.timestamp)}`);
            break;
          }
          case SubMessageId.INFO_DST:
            // INFO_DST is already handled by setting guidPrefix on other submessages
            const infoDst = msg as InfoDstView;
            this._log?.debug?.(`  [SUBMSG] INFO_DST ${infoDst.guidPrefix}`);
            break;
          case SubMessageId.HEARTBEAT:
            this.handleHeartbeat(message.guidPrefix, msg as HeartbeatView);
            break;
          case SubMessageId.ACKNACK:
            this.handleAckNack(message.guidPrefix, msg as AckNackView);
            break;
          case SubMessageId.DATA:
            this.handleDataMsg(message.guidPrefix, msg as DataMsgView);
            break;
          case SubMessageId.GAP:
            this.handleGap(message.guidPrefix, msg as GapView);
            break;
          case SubMessageId.DATA_FRAG:
            this.handleDataFrag(message.guidPrefix, msg as DataFragView);
            break;
          case SubMessageId.HEARTBEAT_FRAG:
            this.handleHeartbeatFrag(message.guidPrefix, msg as HeartbeatFragView);
            break;
          case SubMessageId.NACK_FRAG:
            this.handleNackFrag(message.guidPrefix, msg as NackFragView);
            break;
          default:
            this._log?.warn?.(`ignoring unhandled submessage ${msg.submessageId}`);
            break;
        }
      } catch (err) {
        this.handleError(err as Error);
      }
    }
  };

  private handleHeartbeat = (guidPrefix: GuidPrefix, heartbeat: HeartbeatView): void => {
    this._log?.debug?.(
      `  [SUBMSG] HEARTBEAT reader=${this.readerName(
        heartbeat.readerEntityId,
      )} writer=${this.writerName(heartbeat.writerEntityId)} seq=${
        heartbeat.firstAvailableSeqNumber
      },${heartbeat.lastSeqNumber} (count=${heartbeat.count}, liveliness=${
        heartbeat.liveliness
      }, final=${heartbeat.final})`,
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
      `  [SUBMSG] GAP reader=${this.readerName(readerEntityId)} writer=${this.writerName(
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
      `  [SUBMSG] ACKNACK reader=${this.readerName(
        ackNack.readerEntityId,
      )} writer=${this.writerName(ackNack.writerEntityId)} ${ackNack.readerSNState.toString()}`,
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

    void this.sendChangesTo(
      readerView,
      writer,
      participant.attributes.metatrafficUnicastLocatorList,
    );
  };

  private handleDataMsg = (guidPrefix: GuidPrefix, dataMsg: DataMsgView): void => {
    this.handleData(
      dataMsg.effectiveTimestamp ?? fromDate(new Date()),
      guidPrefix,
      dataMsg.readerEntityId,
      dataMsg.writerEntityId,
      dataMsg.writerSeqNumber,
      dataMsg.serializedData,
    );
  };

  private handleData = (
    timestamp: Time,
    guidPrefix: GuidPrefix,
    readerEntityId: EntityId,
    writerEntityId: EntityId,
    writerSeqNumber: SequenceNumber,
    serializedData: Uint8Array,
  ): void => {
    const writerGuid = makeGuid(guidPrefix, writerEntityId);

    // Get all of our readers for this writer
    const readers = this.getReaders(readerEntityId, writerGuid);
    this._log?.debug?.(
      `  [SUBMSG] DATA reader=${this.readerName(readerEntityId)} writer=${this.writerName(
        writerEntityId,
      )} ${serializedData.length} bytes (seq ${writerSeqNumber}) from ${writerGuid}, ${
        readers.length
      } reader(s)`,
    );

    let instanceHandle: Guid | undefined;
    switch (writerEntityId) {
      case EntityIdBuiltin.PublicationsWriter:
        instanceHandle = this.handlePublication(serializedData, timestamp);
        break;
      case EntityIdBuiltin.SubscriptionsWriter:
        instanceHandle = this.handleSubscription(serializedData, timestamp);
        break;
      case EntityIdBuiltin.ParticipantWriter:
        instanceHandle = this.handleParticipant(guidPrefix, serializedData, timestamp);
        break;
      case EntityIdBuiltin.ParticipantMessageWriter:
        instanceHandle = this.handleParticipantMessage(
          guidPrefix,
          writerEntityId,
          serializedData,
          timestamp,
        );
        break;
      case EntityIdBuiltin.TypeLookupRequestWriter:
        this._log?.warn?.(`received type lookup request from ${guidPrefix}`);
        break;
      case EntityIdBuiltin.TypeLookupReplyWriter:
        this._log?.warn?.(`received type lookup reply from ${guidPrefix}`);
        break;
      default:
        instanceHandle = this.handleUserData(
          guidPrefix,
          writerEntityId,
          writerSeqNumber,
          serializedData,
          timestamp,
          readers,
        );
        break;
    }

    for (const reader of readers) {
      // Record this data message into the reader's history
      reader.history.set({
        timestamp,
        kind: ChangeKind.Alive,
        writerGuid,
        sequenceNumber: writerSeqNumber,
        data: serializedData,
        instanceHandle,
      });
    }
  };

  private handleDataFrag = (guidPrefix: GuidPrefix, dataFrag: DataFragView): void => {
    const participant = this._participants.get(guidPrefix);
    if (participant == undefined) {
      this._log?.warn?.(`received DATA_FRAG from unknown participant ${guidPrefix}`);
      return;
    }

    const {
      effectiveTimestamp,
      readerEntityId,
      writerEntityId,
      writerSeqNumber,
      sampleSize,
      fragmentSize,
      fragmentStartingNum,
      fragments,
    } = dataFrag;

    const fragmentTracker = participant.getFragments(
      writerEntityId,
      writerSeqNumber,
      sampleSize,
      fragmentSize,
    );

    let recvBytes = 0;
    for (let i = 0; i < fragments.length; i++) {
      const fragment = fragments[i]!;
      const index = fragmentStartingNum + i - 1;
      fragmentTracker.addFragment(index, fragment);
      recvBytes += fragment.length;
    }

    const currentFragments = fragmentTracker.fragmentCount - fragmentTracker.remainingFragments;
    this._log?.debug?.(
      `  [SUBMSG] DATA_FRAG writer=${this.writerName(
        writerEntityId,
      )} fragmentStartingNum=${fragmentStartingNum}, fragments=${
        fragments.length
      }, ${recvBytes} bytes frags=${currentFragments}/${fragmentTracker.fragmentCount} [${(
        (currentFragments / fragmentTracker.fragmentCount) *
        100
      ).toFixed(1)}%] (seq ${writerSeqNumber}) from ${makeGuid(guidPrefix, writerEntityId)}`,
    );

    // Check if the complete DATA message is available
    const serializedData = fragmentTracker.data();
    if (serializedData != undefined) {
      // Stop tracking the individual fragments of this message
      participant.removeFragments(writerEntityId, writerSeqNumber);

      // Handle the assembled data message
      this.handleData(
        effectiveTimestamp ?? fromDate(new Date()),
        guidPrefix,
        readerEntityId,
        writerEntityId,
        writerSeqNumber,
        serializedData,
      );
    }
  };

  private handleHeartbeatFrag = (
    guidPrefix: GuidPrefix,
    heartbeatFrag: HeartbeatFragView,
  ): void => {
    const participant = this._participants.get(guidPrefix);
    if (participant == undefined) {
      this._log?.warn?.(`received HEARTBEAT_FRAG from unknown participant ${guidPrefix}`);
      return;
    }

    const fragmentTracker = participant.tryGetFragments(
      heartbeatFrag.writerEntityId,
      heartbeatFrag.writerSeqNumber,
    );
    if (fragmentTracker == undefined) {
      this._log?.warn?.(
        `received HEARTBEAT_FRAG for unknown packet ${uint32ToHex(
          heartbeatFrag.writerEntityId,
        )} :: ${heartbeatFrag.writerSeqNumber}`,
      );
      return;
    }

    if (!fragmentTracker.hasUpTo(heartbeatFrag.lastFragmentNumber - 1)) {
      // One or more fragments are missing, send a NACK_FRAG
      void this.sendNackFragTo(
        guidPrefix,
        heartbeatFrag,
        fragmentTracker,
        participant.attributes.metatrafficUnicastLocatorList,
      );
    }
  };

  private handleNackFrag = (_guidPrefix: GuidPrefix, _nackFrag: NackFragView): void => {
    // TODO: Handle this when we support publishing fragmented data
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
    serializedData: Uint8Array,
    timestamp: Time | undefined,
  ): Guid | undefined => {
    const params = ParametersView.FromCdr(serializedData);
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
          void this.sendChangesTo(
            reader,
            writer,
            participant.attributes.metatrafficUnicastLocatorList,
          );
        }
      }

      // Send preemptive heartbeats for participant readers
      void this.sendInitialHeartbeats(participant);
    } else {
      this._log?.debug?.(`updating participant ${guidPrefix}`);
      participant.update(participantData);
    }

    return guid;
  };

  private handleParticipantMessage = (
    senderGuidPrefix: GuidPrefix,
    writerEntityId: EntityId,
    serializedData: Uint8Array,
    _timestamp: Time | undefined,
  ): Guid | undefined => {
    const reader = new CdrReader(serializedData);
    const guidPrefix = guidPrefixFromCDR(reader);
    const guid = makeGuid(guidPrefix, EntityIdBuiltin.Participant);

    this._log?.debug?.(
      `received participant message from ${makeGuid(senderGuidPrefix, writerEntityId)} for ${guid}`,
    );

    // TODO: Handle this when we have a concept of participant alive/stale states

    return guid;
  };

  private handleUserData = (
    senderGuidPrefix: GuidPrefix,
    writerEntityId: EntityId,
    writerSeqNumber: SequenceNumber,
    serializedData: Uint8Array,
    timestamp: Time | undefined,
    readers: Reader[],
  ): undefined => {
    const participant = this._participants.get(senderGuidPrefix);
    if (participant == undefined) {
      this._log?.warn?.(`received user data from unknown participant ${senderGuidPrefix}`);
      return undefined;
    }

    const writerView = participant.remoteWriters.get(writerEntityId);
    if (writerView == undefined) {
      this._log?.warn?.(`received user data from unknown writer ${uint32ToHex(writerEntityId)}`);
      return undefined;
    }

    if (readers.length === 0) {
      this._log?.warn?.(
        `received user data from writer ${uint32ToHex(writerEntityId)} with no readers`,
      );
      return undefined;
    }

    for (const reader of readers) {
      this.emit("userData", {
        timestamp,
        publication: writerView.attributes,
        subscription: reader.attributes,
        writerSeqNumber,
        serializedData,
      });
    }

    return undefined;
  };

  private handlePublication = (
    serializedData: Uint8Array,
    timestamp: Time | undefined,
  ): Guid | undefined => {
    const params = ParametersView.FromCdr(serializedData);
    const attributes = parseEndpoint(params, timestamp);
    if (attributes == undefined) {
      this._log?.warn?.(
        `failed to parse publication attributes from ${serializedData.length} byte DATA`,
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
    serializedData: Uint8Array,
    timestamp: Time | undefined,
  ): Guid | undefined => {
    const params = ParametersView.FromCdr(serializedData);
    const attributes = parseEndpoint(params, timestamp);
    if (attributes == undefined) {
      this._log?.warn?.(
        `failed to parse subscription attributes from ${serializedData.length} byte payload`,
      );
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
