import { Duration, Time } from "@foxglove/rostime";

import { EntityId } from "./EntityId";
import { GuidPrefix } from "./GuidPrefix";
import { SequenceNumber } from "./SequenceNumber";
import { HistoryKind, Reliability, VendorId } from "./enums";

export type ProtocolVersion = {
  major: number;
  minor: number;
};

export type HistoryAndDepth = {
  kind: HistoryKind;
  depth: number;
};

export type ReliabilityAndMaxBlockingTime = {
  kind: Reliability;
  maxBlockingTime: Duration;
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
