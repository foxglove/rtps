import { Duration } from "@foxglove/rostime";

import { Endpoint } from "./Endpoint";
import { EntityId } from "./EntityId";
import { GuidPrefix } from "./GuidPrefix";
import { Locator } from "./Locator";
import { BuiltinEndpointSet, VendorId } from "./enums";
import { hasBuiltinEndpoint } from "./hasBuiltinEndpoint";
import { ProtocolVersion, DiscoveredParticipantData } from "./types";

export class RtpsParticipantView {
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
  endpoints = new Map<number, Endpoint>();

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

    const endpoints = data.availableBuiltinEndpoints;
    if (hasBuiltinEndpoint(endpoints, BuiltinEndpointSet.PublicationAnnouncer)) {
      this.endpoints.set(
        EntityId.BuiltinPublicationsWriter.value,
        new Endpoint(EntityId.BuiltinPublicationsReader, EntityId.BuiltinPublicationsWriter),
      );
    }
    if (hasBuiltinEndpoint(endpoints, BuiltinEndpointSet.SubscriptionAnnouncer)) {
      this.endpoints.set(
        EntityId.BuiltinSubscriptionsWriter.value,
        new Endpoint(EntityId.BuiltinSubscriptionsReader, EntityId.BuiltinSubscriptionsWriter),
      );
    }
    if (hasBuiltinEndpoint(endpoints, BuiltinEndpointSet.ParticipantMessageDataWriter)) {
      this.endpoints.set(
        EntityId.BuiltinParticipantMessageWriter.value,
        new Endpoint(
          EntityId.BuiltinParticipantMessageReader,
          EntityId.BuiltinParticipantMessageWriter,
        ),
      );
    }
  }
}
