import { Duration, fromMillis } from "@foxglove/rostime";

import { ParticipantAttributes } from "./ParticipantAttributes";
import {
  EntityId,
  EntityIdBuiltin,
  GuidPrefix,
  Locator,
  BuiltinEndpointSet,
  HistoryKind,
  Reliability,
  VendorId,
  hasBuiltinEndpoint,
  ProtocolVersion,
  DiscoveredEndpointData,
} from "./common";
import { Endpoint } from "./routing";

export class ParticipantView {
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
  endpoints = new Map<EntityId, Endpoint>(); // entityId -> Endpoint
  topicToEntityId = new Map<string, EntityId>(); // topicName -> writer entityId
  subscriptions = new Map<string, number>(); // topicName -> subscriptionId
  nextSubscriptionId = 6;

  constructor(data: ParticipantAttributes) {
    this.guidPrefix = data.guidPrefix;
    this.protocolVersion = data.protocolVersion;
    this.vendorId = data.vendorId;
    this.expectsInlineQoS = data.expectsInlineQoS;
    this.metatrafficUnicastLocatorList = data.metatrafficUnicastLocatorList;
    this.metatrafficMulticastLocatorList = data.metatrafficMulticastLocatorList;
    this.defaultUnicastLocatorList = data.defaultUnicastLocatorList;
    this.defaultMulticastLocatorList = data.defaultMulticastLocatorList;
    this.availableBuiltinEndpoints = data.availableBuiltinEndpoints;
    this.leaseDuration = data.leaseDuration;

    const endpointsAvailable = data.availableBuiltinEndpoints;
    this.maybeAddBuiltin(
      endpointsAvailable,
      BuiltinEndpointSet.PublicationAnnouncer,
      EntityIdBuiltin.PublicationsReader,
      EntityIdBuiltin.PublicationsWriter,
    );
    this.maybeAddBuiltin(
      endpointsAvailable,
      BuiltinEndpointSet.SubscriptionAnnouncer,
      EntityIdBuiltin.SubscriptionsReader,
      EntityIdBuiltin.SubscriptionsWriter,
    );
    this.maybeAddBuiltin(
      endpointsAvailable,
      BuiltinEndpointSet.ParticipantMessageDataWriter,
      EntityIdBuiltin.ParticipantMessageReader,
      EntityIdBuiltin.ParticipantMessageWriter,
    );
  }

  update(data: ParticipantAttributes): void {
    this.protocolVersion = data.protocolVersion;
    this.vendorId = data.vendorId;
    this.expectsInlineQoS = data.expectsInlineQoS;
    this.metatrafficUnicastLocatorList = data.metatrafficUnicastLocatorList;
    this.metatrafficMulticastLocatorList = data.metatrafficMulticastLocatorList;
    this.defaultUnicastLocatorList = data.defaultUnicastLocatorList;
    this.defaultMulticastLocatorList = data.defaultMulticastLocatorList;
    this.availableBuiltinEndpoints = data.availableBuiltinEndpoints;
    this.leaseDuration = data.leaseDuration;
  }

  addSubscription(topicName: string): number {
    let subscriptionId = this.subscriptions.get(topicName);
    if (subscriptionId != undefined) {
      return subscriptionId;
    }
    subscriptionId = this.nextSubscriptionId++;
    this.subscriptions.set(topicName, subscriptionId);
    return subscriptionId;
  }

  private maybeAddBuiltin(
    endpointsAvailable: BuiltinEndpointSet,
    flag: BuiltinEndpointSet,
    readerEntityId: EntityId,
    writerEntityId: EntityId,
  ): void {
    if (hasBuiltinEndpoint(endpointsAvailable, flag)) {
      const data: DiscoveredEndpointData = {
        guidPrefix: this.guidPrefix,
        entityId: writerEntityId,
        reliability: { kind: Reliability.Reliable, maxBlockingTime: fromMillis(100) },
        history: { kind: HistoryKind.KeepLast, depth: 0 },
        protocolVersion: this.protocolVersion,
        vendorId: this.vendorId,
      };
      this.endpoints.set(
        writerEntityId,
        new Endpoint({ participant: this, readerEntityId, writerEntityId, data }),
      );
    }
  }
}
