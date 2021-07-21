export const LittleEndian = 1;

export enum SubMessageId {
  PAD = 0x01,
  ACKNACK = 0x06,
  HEARTBEAT = 0x07,
  GAP = 0x08,
  INFO_TS = 0x09,
  INFO_DST = 0x0e,
  NACK_FRAG = 0x12,
  HEARTBEAT_FRAG = 0x13,
  DATA = 0x15,
  DATA_FRAG = 0x16,
  SEC_BODY = 0x30,
  SEC_PREFIX = 0x31,
  SEC_POSTFIX = 0x32,
  SRTPS_PREFIX = 0x33,
  SRTPS_POSTFIX = 0x34,
}

export interface SubMessage {
  write(output: DataView, offset: number, littleEndian: boolean): number;
}
