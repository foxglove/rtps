import { fromMillis } from "@foxglove/rostime";

import { ParticipantAttributes } from "./ParticipantAttributes";
import {
  EntityId,
  EntityIdBuiltin,
  BuiltinEndpointSet,
  HistoryKind,
  Reliability,
  hasBuiltinEndpoint,
} from "./common";
import { EndpointAttributes } from "./routing";
import { ReaderView } from "./routing/ReaderView";
import { WriterView } from "./routing/WriterView";

export class ParticipantView {
  readonly attributes: ParticipantAttributes;
  readonly readers = new Map<EntityId, ReaderView>();
  readonly writers = new Map<EntityId, WriterView>();
  readonly writerIdToReaders = new Map<EntityId, ReaderView[]>();
  readonly publications = new Map<EntityId, EndpointAttributes>();
  readonly subscriptions = new Map<EntityId, EndpointAttributes>();

  constructor(attributes: ParticipantAttributes) {
    this.attributes = attributes;

    // Create readers and writers for the builtin endpoints this participant advertises
    const endpoints = attributes.availableBuiltinEndpoints;
    this.maybeAddReader(endpoints, BuiltinEndpointSet.ParticipantDetector, EntityIdBuiltin.ParticipantReader, EntityIdBuiltin.ParticipantWriter); // prettier-ignore
    this.maybeAddReader(endpoints, BuiltinEndpointSet.PublicationDetector, EntityIdBuiltin.PublicationsReader, EntityIdBuiltin.PublicationsWriter); // prettier-ignore
    this.maybeAddReader(endpoints, BuiltinEndpointSet.SubscriptionDetector, EntityIdBuiltin.SubscriptionsReader, EntityIdBuiltin.SubscriptionsWriter); // prettier-ignore
    this.maybeAddReader(endpoints, BuiltinEndpointSet.ParticipantMessageDataReader, EntityIdBuiltin.ParticipantMessageReader, EntityIdBuiltin.ParticipantMessageWriter); // prettier-ignore
    this.maybeAddWriter(endpoints, BuiltinEndpointSet.ParticipantAnnouncer, EntityIdBuiltin.ParticipantReader, EntityIdBuiltin.ParticipantWriter); // prettier-ignore
    this.maybeAddWriter(endpoints, BuiltinEndpointSet.PublicationAnnouncer, EntityIdBuiltin.PublicationsReader, EntityIdBuiltin.PublicationsWriter); // prettier-ignore
    this.maybeAddWriter(endpoints, BuiltinEndpointSet.SubscriptionAnnouncer, EntityIdBuiltin.SubscriptionsReader, EntityIdBuiltin.SubscriptionsWriter); // prettier-ignore
    this.maybeAddWriter(endpoints, BuiltinEndpointSet.ParticipantMessageDataWriter, EntityIdBuiltin.ParticipantMessageReader, EntityIdBuiltin.ParticipantMessageWriter); // prettier-ignore
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

  private maybeAddReader(
    endpointsAvailable: BuiltinEndpointSet,
    flag: BuiltinEndpointSet,
    readerEntityId: EntityId,
    writerEntityId: EntityId,
  ): void {
    if (!hasBuiltinEndpoint(endpointsAvailable, flag)) {
      return;
    }

    const view = new ReaderView({
      guidPrefix: this.attributes.guidPrefix,
      entityId: readerEntityId,
      reliability: { kind: Reliability.Reliable, maxBlockingTime: fromMillis(100) },
      history: { kind: HistoryKind.KeepLast, depth: 0 },
      protocolVersion: this.attributes.protocolVersion,
      vendorId: this.attributes.vendorId,
    });
    this.readers.set(readerEntityId, view);

    const readersForWriter = this.writerIdToReaders.get(writerEntityId) ?? [];
    readersForWriter.push(view);
    this.writerIdToReaders.set(writerEntityId, readersForWriter);
  }

  private maybeAddWriter(
    endpointsAvailable: BuiltinEndpointSet,
    flag: BuiltinEndpointSet,
    _readerEntityId: EntityId,
    writerEntityId: EntityId,
  ): void {
    if (!hasBuiltinEndpoint(endpointsAvailable, flag)) {
      return;
    }

    const view = new WriterView({
      guidPrefix: this.attributes.guidPrefix,
      entityId: writerEntityId,
      reliability: { kind: Reliability.Reliable, maxBlockingTime: fromMillis(100) },
      history: { kind: HistoryKind.KeepLast, depth: 0 },
      protocolVersion: this.attributes.protocolVersion,
      vendorId: this.attributes.vendorId,
    });
    this.writers.set(writerEntityId, view);
  }
}
