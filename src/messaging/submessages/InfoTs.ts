import { Time } from "@foxglove/rostime";

import {
  fractionToNanoseconds,
  LittleEndian,
  nanosecondsToFraction,
  SubMessageId,
} from "../../common";
import { SubMessage } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";

const DATA_LENGTH = 8;

export class InfoTs implements SubMessage {
  constructor(public timestamp: Time) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    output.setUint8(offset, SubMessageId.INFO_TS);
    output.setUint8(offset + 1, littleEndian ? LittleEndian : 0); // flags
    output.setUint16(offset + 2, DATA_LENGTH, littleEndian); // octetsToNextHeader
    output.setInt32(offset + 4, this.timestamp.sec, littleEndian);
    output.setUint32(offset + 8, nanosecondsToFraction(this.timestamp.nsec), littleEndian);
    return 12;
  }
}

export class InfoTsView extends SubMessageView {
  get timestamp(): Time {
    const sec = this.view.getInt32(this.offset + 4, this.littleEndian);
    const fraction = this.view.getUint32(this.offset + 8, this.littleEndian);
    const nsec = fractionToNanoseconds(fraction);
    return { sec, nsec };
  }
}
