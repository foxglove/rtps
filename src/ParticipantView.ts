import { Duration } from "@foxglove/rostime";

import { Endpoint } from "./Endpoint";
import {
  EntityIdBuiltinParticipantMessageReader,
  EntityIdBuiltinParticipantMessageWriter,
  EntityIdBuiltinPublicationsReader,
  EntityIdBuiltinPublicationsWriter,
  EntityIdBuiltinSubscriptionsReader,
  EntityIdBuiltinSubscriptionsWriter,
} from "./EntityId";
import { GuidPrefix } from "./GuidPrefix";
import { Locator } from "./Locator";
import { Topic } from "./Topic";
import { BuiltinEndpointSet, VendorId } from "./enums";
import { hasBuiltinEndpoint } from "./hasBuiltinEndpoint";
import { ProtocolVersion, DiscoveredParticipantData } from "./types";

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
  endpoints = new Map<number, Endpoint>(); // entityId -> Endpoint
  topicsMap = new Map<string, Topic>(); // topicName -> Topic
  ackNackCount = 0;

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
    if (hasBuiltinEndpoint(endpointsAvailable, BuiltinEndpointSet.PublicationAnnouncer)) {
      this.endpoints.set(
        EntityIdBuiltinPublicationsWriter,
        new Endpoint({
          participant: this,
          readerEntityId: EntityIdBuiltinPublicationsReader,
          writerEntityId: EntityIdBuiltinPublicationsWriter,
        }),
      );
    }
    if (hasBuiltinEndpoint(endpointsAvailable, BuiltinEndpointSet.SubscriptionAnnouncer)) {
      this.endpoints.set(
        EntityIdBuiltinSubscriptionsWriter,
        new Endpoint({
          participant: this,
          readerEntityId: EntityIdBuiltinSubscriptionsReader,
          writerEntityId: EntityIdBuiltinSubscriptionsWriter,
        }),
      );
    }
    if (hasBuiltinEndpoint(endpointsAvailable, BuiltinEndpointSet.ParticipantMessageDataWriter)) {
      this.endpoints.set(
        EntityIdBuiltinParticipantMessageWriter,
        new Endpoint({
          participant: this,
          readerEntityId: EntityIdBuiltinParticipantMessageReader,
          writerEntityId: EntityIdBuiltinParticipantMessageWriter,
        }),
      );
    }
  }
}
