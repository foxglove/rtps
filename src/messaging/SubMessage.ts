export interface SubMessage {
  write(output: DataView, offset: number, littleEndian: boolean): number;
}
