import { Time, Duration } from "@foxglove/rostime";

import {
  EntityId,
  GuidPrefix,
  VendorId,
  BuiltinEndpointSet,
  ProtocolVersion,
  Locator,
} from "./common";

export type DiscoveredParticipantData = {
  timestamp?: Time;
  guidPrefix: GuidPrefix;
  entityId: EntityId;
  protocolVersion: ProtocolVersion;
  vendorId: VendorId;
  expectsInlineQoS: boolean;
  metatrafficUnicastLocatorList: Locator[];
  metatrafficMulticastLocatorList: Locator[];
  defaultUnicastLocatorList: Locator[];
  defaultMulticastLocatorList: Locator[];
  availableBuiltinEndpoints: BuiltinEndpointSet;
  leaseDuration: Duration;
  userData?: string;
};
