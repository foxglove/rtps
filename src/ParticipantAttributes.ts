import { Time, Duration } from "@foxglove/rostime";

import {
  EntityId,
  GuidPrefix,
  VendorId,
  BuiltinEndpointSet,
  ProtocolVersion,
  Locator,
} from "./common";

export type ParticipantAttributes = {
  timestamp?: Time;
  guidPrefix: GuidPrefix;
  entityId: EntityId;
  protocolVersion: Readonly<ProtocolVersion>;
  vendorId: VendorId;
  domainId: number;
  expectsInlineQoS: boolean;
  metatrafficUnicastLocatorList: Locator[];
  metatrafficMulticastLocatorList: Locator[];
  defaultUnicastLocatorList: Locator[];
  defaultMulticastLocatorList: Locator[];
  availableBuiltinEndpoints: BuiltinEndpointSet;
  leaseDuration: Duration;
  userData?: string;
};
