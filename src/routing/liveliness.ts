import { CdrWriter } from "@foxglove/cdr";

import { GuidPrefix, writeGuidPrefixToCDR } from "../common";

const AUTOMATIC_LIVELINESS_UPDATE = 1;
const MANUAL_LIVELINESS_UPDATE = 2;

export function livelinessPayload(guidPrefix: GuidPrefix, manual: boolean): Uint8Array {
  const cdr = new CdrWriter({ size: 24 });
  writeGuidPrefixToCDR(guidPrefix, cdr);
  cdr.uint32BE(manual ? MANUAL_LIVELINESS_UPDATE : AUTOMATIC_LIVELINESS_UPDATE);
  cdr.sequenceLength(1);
  cdr.uint8(0);
  cdr.align(4);
  return cdr.data;
}
