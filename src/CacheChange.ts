import { Guid } from "./Guid";
import { ChangeKind } from "./enums";

export type CacheChange = {
  kind: ChangeKind;
  writerGuid: Guid;
  sequenceNumber: bigint;
  data: Uint8Array;
};
