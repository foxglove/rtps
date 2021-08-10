import { Time } from "@foxglove/rostime";

import { SequenceNumber } from "../common";
import { EndpointAttributes } from "./Endpoint";

export type UserData = {
  timestamp?: Time;
  publication: EndpointAttributes;
  subscription: EndpointAttributes;
  writerSeqNumber: SequenceNumber;
  serializedData: Uint8Array;
};
