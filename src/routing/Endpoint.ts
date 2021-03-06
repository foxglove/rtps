import { Time } from "@foxglove/rostime";

import {
  Durability,
  EntityId,
  GuidPrefix,
  HistoryAndDepth,
  ProtocolVersion,
  ReliabilityAndMaxBlockingTime,
  VendorId,
} from "../common";

export type EndpointAttributes = {
  timestamp?: Time;
  guidPrefix: GuidPrefix;
  entityId: EntityId;
  topicName?: string;
  typeName?: string;
  durability: Durability;
  reliability: Readonly<ReliabilityAndMaxBlockingTime>;
  history: Readonly<HistoryAndDepth>;
  protocolVersion: Readonly<ProtocolVersion>;
  vendorId: VendorId;
  userData?: string;
};

export type EndpointAttributesWithTopic = EndpointAttributes & {
  topicName: string;
  typeName: string;
};
