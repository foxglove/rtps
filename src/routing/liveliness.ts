import { CdrWriter } from "@foxglove/cdr";

import { GuidPrefix, writeGuidPrefixToCDR } from "../common";

export function livelinessPayload(guidPrefix: GuidPrefix): Uint8Array {
  const cdr = new CdrWriter({ size: 24 });
  writeGuidPrefixToCDR(guidPrefix, cdr);
  cdr.uint32BE(1); // kind: PARTICIPANT_MESSAGE_DATA_KIND_AUTOMATIC_LIVELINESS_UPDATE
  cdr.sequenceLength(1);
  cdr.uint8(0);
  cdr.align(4);
  return cdr.data;
}
