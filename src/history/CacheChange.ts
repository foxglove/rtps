import { Time } from "@foxglove/rostime";

import { Guid } from "../common/Guid";
import { SequenceNumber } from "../common/SequenceNumber";
import { ChangeKind } from "../common/enums";

export type CacheChange = {
  timestamp: Time;
  kind: ChangeKind;
  writerGuid: Guid;
  sequenceNumber: SequenceNumber;
  data: Uint8Array;
};
