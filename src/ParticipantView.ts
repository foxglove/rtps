import { Duration, fromMillis } from "@foxglove/rostime";

import { Endpoint } from "./Endpoint";
import {
  EntityId,
  EntityIdBuiltinParticipantMessageReader,
  EntityIdBuiltinParticipantMessageWriter,
  EntityIdBuiltinPublicationsReader,
  EntityIdBuiltinPublicationsWriter,
  EntityIdBuiltinSubscriptionsReader,
  EntityIdBuiltinSubscriptionsWriter,
} from "./EntityId";
import { GuidPrefix } from "./GuidPrefix";
import { Locator } from "./Locator";
import { BuiltinEndpointSet, History, Reliability, VendorId } from "./enums";
import { hasBuiltinEndpoint } from "./hasBuiltinEndpoint";
import { ProtocolVersion, DiscoveredParticipantData, DiscoveredEndpointData } from "./types";

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

  constructor(data: DiscoveredParticipantData) {
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
      EntityIdBuiltinPublicationsReader,
      EntityIdBuiltinPublicationsWriter,
    );
    this.maybeAddBuiltin(
      endpointsAvailable,
      BuiltinEndpointSet.SubscriptionAnnouncer,
      EntityIdBuiltinSubscriptionsReader,
      EntityIdBuiltinSubscriptionsWriter,
    );
    this.maybeAddBuiltin(
      endpointsAvailable,
      BuiltinEndpointSet.ParticipantMessageDataWriter,
      EntityIdBuiltinParticipantMessageReader,
      EntityIdBuiltinParticipantMessageWriter,
    );
  }

  update(data: DiscoveredParticipantData): void {
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
        history: { kind: History.KeepLast, depth: 0 },
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
