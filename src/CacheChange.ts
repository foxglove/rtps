import { Time } from "@foxglove/rostime";

import { Guid } from "./Guid";
import { SequenceNumber } from "./SequenceNumber";
import { ChangeKind } from "./enums";

export type CacheChange = {
  timestamp: Time;
  kind: ChangeKind;
  writerGuid: Guid;
  sequenceNumber: SequenceNumber;
  data: Uint8Array;
};
