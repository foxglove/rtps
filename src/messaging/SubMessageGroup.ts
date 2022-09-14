import { SubMessage } from "./SubMessage";

export type SubMessageGroupOptions = {
  bigEndian?: boolean;
  maxSize?: number;
};

/**
 * A sequence of SubMessages that must be delivered in the same UDP datagram.
 */
export class SubMessageGroup {
  private littleEndian: boolean;
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;

  get data(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  get size(): number {
    return this.offset;
  }

  constructor({ bigEndian = false, maxSize = 1400 }: SubMessageGroupOptions = {}) {
    this.littleEndian = !bigEndian;
    this.buffer = new ArrayBuffer(maxSize);
    this.view = new DataView(this.buffer);
    this.offset = 0;
  }

  writeSubmessage(msg: SubMessage): void {
    const prevOffset = this.offset;
    this.offset += msg.write(this.view, this.offset, this.littleEndian);
    if (this.offset > this.buffer.byteLength) {
      throw new Error(
        `SubMessageGroup buffer overflow: ${prevOffset} + ${this.offset - prevOffset} > ${
          this.buffer.byteLength
        }`,
      );
    }
  }
}
