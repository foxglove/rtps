import { Duration, Time } from "@foxglove/rostime";

import { Guid } from "./Guid";
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

export type DiscoveredParticipantData = {
  timestamp?: Time;
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
  userData?: string;
};

export type DiscoveredTopicData = {
  timestamp?: Time;
  guidPrefix: GuidPrefix;
  topicName: string;
  typeName: string;
  reliability: Reliability;
  history: HistoryAndDepth;
  protocolVersion: ProtocolVersion;
  vendorId: VendorId;
  endpointGuid: Guid;
  userData?: string;
};

export type UserData = {
  timestamp?: Time;
  topic: DiscoveredTopicData;
  writerSeqNumber: SequenceNumber;
  serializedData: Uint8Array;
};
