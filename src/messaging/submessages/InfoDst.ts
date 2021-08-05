import {
  GuidPrefix,
  guidPrefixFromData,
  writeGuidPrefix,
  LittleEndian,
  SubMessageId,
} from "../../common";
import { SubMessage } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";

export class InfoDst implements SubMessage {
  constructor(public guidPrefix: GuidPrefix) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    output.setUint8(offset, SubMessageId.INFO_DST);
    output.setUint8(offset + 1, littleEndian ? LittleEndian : 0); // flags
    output.setUint16(offset + 2, 12, littleEndian); // octetsToNextHeader
    writeGuidPrefix(this.guidPrefix, output, offset + 4);
    return 16;
  }
}

export class InfoDstView extends SubMessageView {
  get guidPrefix(): GuidPrefix {
    return guidPrefixFromData(this.view, this.offset + 4);
  }
}
