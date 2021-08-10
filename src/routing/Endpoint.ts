import { Time } from "@foxglove/rostime";

import {
  EntityId,
  GuidPrefix,
  HistoryAndDepth,
  ProtocolVersion,
  ReliabilityAndMaxBlockingTime,
  VendorId,
} from "../common";
import { HistoryCache } from "../history";

export type EndpointAttributes = {
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

export interface Endpoint {
  attributes: EndpointAttributes;
  history: HistoryCache;
}
