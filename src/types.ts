import { Duration, Time } from "@foxglove/rostime";

import { EntityId } from "./EntityId";
import { GuidPrefix } from "./GuidPrefix";
import { Locator } from "./Locator";
import { SequenceNumber } from "./SequenceNumber";
import { BuiltinEndpointSet, History, Reliability, VendorId } from "./enums";

export type ProtocolVersion = {
  major: number;
  minor: number;
};

export type HistoryAndDepth = {
  kind: History;
  depth: number;
};

export type ReliabilityAndMaxBlockingTime = {
  kind: Reliability;
  maxBlockingTime: Duration;
};

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

export type DiscoveredEndpointData = {
  timestamp?: Time;
  guidPrefix: GuidPrefix;
  entityId: EntityId;
  topicName?: string;
  typeName?: string;
  reliability: ReliabilityAndMaxBlockingTime;
  history: HistoryAndDepth;
  protocolVersion: ProtocolVersion;
  vendorId: VendorId;
  userData?: string;
};

export type UserData = {
  timestamp?: Time;
  publication: DiscoveredEndpointData;
  subscription: DiscoveredEndpointData;
  writerSeqNumber: SequenceNumber;
  serializedData: Uint8Array;
};
