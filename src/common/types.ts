import { Duration } from "@foxglove/rostime";

import { HistoryKind, Reliability } from "./enums";

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
