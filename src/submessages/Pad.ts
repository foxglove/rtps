import { LittleEndian, SubMessage, SubMessageId } from "../SubMessage";
import { SubMessageView } from "../SubMessageView";

export class Pad implements SubMessage {
  constructor(public padLength: number) {}

  write(output: DataView, offset: number, littleEndian: boolean): number {
    output.setUint8(offset, SubMessageId.PAD);
    output.setUint8(offset + 1, littleEndian ? LittleEndian : 0); // flags
    output.setUint16(offset + 2, this.padLength, littleEndian); // octetsToNextHeader
    return 4 + this.padLength;
  }
}

export class PadView extends SubMessageView {}
