import { fromMillis } from "@foxglove/rostime";

import type { Participant } from "./Participant";
import type { ParticipantAttributes } from "./ParticipantAttributes";
import {
  EntityId,
  EntityIdBuiltin,
  BuiltinEndpointSet,
  HistoryKind,
  Reliability,
  hasBuiltinEndpoint,
  ReliabilityAndMaxBlockingTime,
  HistoryAndDepth,
} from "./common";
import { Reader } from "./routing";
import { ReaderView } from "./routing/ReaderView";
import { WriterView } from "./routing/WriterView";

const BUILTIN_RELIABILITY: ReliabilityAndMaxBlockingTime = {
  kind: Reliability.Reliable,
  maxBlockingTime: fromMillis(100),
};
const BUILTIN_HISTORY: HistoryAndDepth = { kind: HistoryKind.KeepLast, depth: 1 };

export class ParticipantView {
  readonly attributes: ParticipantAttributes;
  readonly localReaders = new Map<EntityId, Reader>();
  readonly remoteReaders = new Map<EntityId, ReaderView>();
  readonly remoteWriters = new Map<EntityId, WriterView>();

  readonly localReaderIdToRemoteWriterId = new Map<EntityId, EntityId>();
  readonly localWriterIdToRemoteReaderIds = new Map<EntityId, EntityId[]>();
  readonly remoteReaderIdToLocalWriterId = new Map<EntityId, EntityId>();
  readonly remoteWriterIdToLocalReaderIds = new Map<EntityId, EntityId[]>();

  constructor(local: Participant, remote: ParticipantAttributes) {
    this.attributes = remote;

    // Create readers and writers for the builtin endpoints this participant advertises
    this.addBuiltin(
      local,
      remote,
      BuiltinEndpointSet.ParticipantDetector,
      BuiltinEndpointSet.ParticipantAnnouncer,
      EntityIdBuiltin.ParticipantReader,
      EntityIdBuiltin.ParticipantWriter,
    );
    this.addBuiltin(
      local,
      remote,
      BuiltinEndpointSet.PublicationDetector,
      BuiltinEndpointSet.PublicationAnnouncer,
      EntityIdBuiltin.PublicationsReader,
      EntityIdBuiltin.PublicationsWriter,
    );
    this.addBuiltin(
      local,
      remote,
      BuiltinEndpointSet.SubscriptionDetector,
      BuiltinEndpointSet.SubscriptionAnnouncer,
      EntityIdBuiltin.SubscriptionsReader,
      EntityIdBuiltin.SubscriptionsWriter,
    );
    this.addBuiltin(
      local,
      remote,
      BuiltinEndpointSet.ParticipantMessageDataReader,
      BuiltinEndpointSet.ParticipantMessageDataWriter,
      EntityIdBuiltin.ParticipantMessageReader,
      EntityIdBuiltin.ParticipantMessageWriter,
    );
  }

  update(attributes: ParticipantAttributes): void {
    this.attributes.protocolVersion = attributes.protocolVersion;
    this.attributes.vendorId = attributes.vendorId;
    this.attributes.expectsInlineQoS = attributes.expectsInlineQoS;
    this.attributes.metatrafficUnicastLocatorList = attributes.metatrafficUnicastLocatorList;
    this.attributes.metatrafficMulticastLocatorList = attributes.metatrafficMulticastLocatorList;
    this.attributes.defaultUnicastLocatorList = attributes.defaultUnicastLocatorList;
    this.attributes.defaultMulticastLocatorList = attributes.defaultMulticastLocatorList;
    this.attributes.availableBuiltinEndpoints = attributes.availableBuiltinEndpoints;
    this.attributes.leaseDuration = attributes.leaseDuration;
  }

  localReadersForWriterId(writerId: EntityId): Reader[] {
    const readerIds = this.remoteWriterIdToLocalReaderIds.get(writerId);
    if (readerIds == undefined) {
      return [];
    }

    const readers: Reader[] = [];
    for (const readerId of readerIds) {
      const reader = this.localReaders.get(readerId);
      if (reader != undefined) {
        readers.push(reader);
      }
    }
    return readers;
  }

  remoteReadersForWriterId(writerId: EntityId): ReaderView[] {
    const readerIds = this.localWriterIdToRemoteReaderIds.get(writerId);
    if (readerIds == undefined) {
      return [];
    }

    const readerViews: ReaderView[] = [];
    for (const readerId of readerIds) {
      const readerView = this.remoteReaders.get(readerId);
      if (readerView != undefined) {
        readerViews.push(readerView);
      }
    }
    return readerViews;
  }

  private addBuiltin(
    local: Participant,
    remote: ParticipantAttributes,
    readerFlag: BuiltinEndpointSet,
    writerFlag: BuiltinEndpointSet,
    readerEntityId: EntityIdBuiltin,
    writerEntityId: EntityIdBuiltin,
  ): void {
    // Check if this remote reader is available
    if (hasBuiltinEndpoint(remote.availableBuiltinEndpoints, readerFlag)) {
      const readerView = new ReaderView({
        guidPrefix: this.attributes.guidPrefix,
        entityId: readerEntityId,
        reliability: BUILTIN_RELIABILITY,
        history: BUILTIN_HISTORY,
        protocolVersion: this.attributes.protocolVersion,
        vendorId: this.attributes.vendorId,
      });
      this.remoteReaders.set(readerEntityId, readerView);

      // Is there a local writer that matches this remote reader?
      if (hasBuiltinEndpoint(local.attributes.availableBuiltinEndpoints, writerFlag)) {
        this.remoteReaderIdToLocalWriterId.set(readerEntityId, writerEntityId);
        addToMultiMap(writerEntityId, readerEntityId, this.localWriterIdToRemoteReaderIds);
      }
    }

    // Check if this remote writer is available
    if (hasBuiltinEndpoint(remote.availableBuiltinEndpoints, writerFlag)) {
      const writerView = new WriterView({
        guidPrefix: this.attributes.guidPrefix,
        entityId: writerEntityId,
        reliability: BUILTIN_RELIABILITY,
        history: BUILTIN_HISTORY,
        protocolVersion: this.attributes.protocolVersion,
        vendorId: this.attributes.vendorId,
      });
      this.remoteWriters.set(writerEntityId, writerView);

      // Is there a local (advertised) reader that matches this remote writer?
      if (hasBuiltinEndpoint(local.attributes.availableBuiltinEndpoints, readerFlag)) {
        this.localReaderIdToRemoteWriterId.set(readerEntityId, writerEntityId);
        addToMultiMap(writerEntityId, readerEntityId, this.remoteWriterIdToLocalReaderIds);

        // Create a local reader for this remote writer
        this.localReaders.set(
          readerEntityId,
          new Reader({
            guidPrefix: local.attributes.guidPrefix,
            entityId: readerEntityId,
            reliability: BUILTIN_RELIABILITY,
            history: BUILTIN_HISTORY,
            protocolVersion: this.attributes.protocolVersion,
            vendorId: this.attributes.vendorId,
          }),
        );
      }
    }
  }
}

function addToMultiMap(key: EntityId, value: EntityId, map: Map<EntityId, EntityId[]>): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}
