import { CdrWriter, EncapsulationKind } from "@foxglove/cdr";
import { Duration } from "@foxglove/rostime";

import {
  Guid,
  writeGuidToCDR,
  Locator,
  BuiltinEndpointSet,
  Durability,
  ParameterId,
  VendorId,
  HistoryAndDepth,
  ProtocolVersion,
  ReliabilityAndMaxBlockingTime,
  nanosecondsToFraction,
} from "../common";

const textEncoder = new TextEncoder();

export class Parameters {
  private writer = new CdrWriter({ kind: EncapsulationKind.PL_CDR_LE, size: 256 });

  get data(): Uint8Array {
    return this.writer.data;
  }

  stringParam(paramterId: ParameterId, value: string): void {
    const length = 4 + value.length + 1;
    this.writePrefix(paramterId, length);
    this.writer.string(value);
    this.writer.align(4);
  }

  topicName(value: string): void {
    this.stringParam(ParameterId.PID_TOPIC_NAME, value);
  }

  typeName(value: string): void {
    this.stringParam(ParameterId.PID_TYPE_NAME, value);
  }

  durability(value: Durability): void {
    const length = 4;
    this.writePrefix(ParameterId.PID_DURABILITY, length);
    this.writer.uint32(value);
    this.writer.align(4);
  }

  reliability(value: ReliabilityAndMaxBlockingTime): void {
    const length = 12;
    this.writePrefix(ParameterId.PID_RELIABILITY, length);
    this.writer.uint32(value.kind);
    this.writer.int32(value.maxBlockingTime.sec);
    this.writer.uint32(nanosecondsToFraction(value.maxBlockingTime.nsec));
    this.writer.align(4);
  }

  history(value: HistoryAndDepth): void {
    const length = 8;
    this.writePrefix(ParameterId.PID_HISTORY, length);
    this.writer.uint32(value.kind);
    this.writer.uint32(value.depth);
    this.writer.align(4);
  }

  endpointGuid(value: Guid): void {
    const length = 16;
    this.writePrefix(ParameterId.PID_ENDPOINT_GUID, length);
    writeGuidToCDR(value, this.writer);
    this.writer.align(4);
  }

  adlinkEntityFactory(value: number): void {
    const length = 4;
    this.writePrefix(ParameterId.PID_ADLINK_ENTITY_FACTORY, length);
    this.writer.uint32(value);
    this.writer.align(4);
  }

  userData(value: Uint8Array): void {
    const length = 4 + value.byteLength;
    this.writePrefix(ParameterId.PID_USER_DATA, length);
    this.writer.uint8Array(value, true);
    this.writer.align(4);
  }

  userDataString(value: string): void {
    this.userData(textEncoder.encode(value));
  }

  protocolVersion(value: ProtocolVersion): void {
    const length = 2;
    this.writePrefix(ParameterId.PID_PROTOCOL_VERSION, length);
    this.writer.uint8(value.major);
    this.writer.uint8(value.minor);
    this.writer.align(4);
  }

  vendorId(value: VendorId): void {
    const length = 2;
    this.writePrefix(ParameterId.PID_VENDORID, length);
    this.writer.uint16BE(value);
    this.writer.align(4);
  }

  participantLeaseDuration(value: Duration): void {
    const length = 8;
    this.writePrefix(ParameterId.PID_PARTICIPANT_LEASE_DURATION, length);
    this.writer.int32(value.sec);
    this.writer.uint32(nanosecondsToFraction(value.nsec));
    this.writer.align(4);
  }

  participantGuid(value: Guid): void {
    const length = 16;
    this.writePrefix(ParameterId.PID_PARTICIPANT_GUID, length);
    writeGuidToCDR(value, this.writer);
    this.writer.align(4);
  }

  builtinEndpointSet(value: BuiltinEndpointSet): void {
    const length = 4;
    this.writePrefix(ParameterId.PID_BUILTIN_ENDPOINT_SET, length);
    this.writer.uint32(value);
    this.writer.align(4);
  }

  domainId(value: number): void {
    const length = 4;
    this.writePrefix(ParameterId.PID_DOMAIN_ID, length);
    this.writer.uint32(value);
    this.writer.align(4);
  }

  defaultUnicastLocator(value: Locator): void {
    const length = 24;
    this.writePrefix(ParameterId.PID_DEFAULT_UNICAST_LOCATOR, length);
    value.toCDR(this.writer);
    this.writer.align(4);
  }

  metatrafficUnicastLocator(value: Locator): void {
    const length = 24;
    this.writePrefix(ParameterId.PID_METATRAFFIC_UNICAST_LOCATOR, length);
    value.toCDR(this.writer);
    this.writer.align(4);
  }

  finish(): void {
    this.writer.uint16(ParameterId.PID_SENTINEL);
    this.writer.uint16(0);
    this.writer.align(4);
  }

  private writePrefix(id: ParameterId, dataLength: number): void {
    // Alignment is a no-op here since each parameter writer is responsible for
    // writing its own trailing padding bytes. However, this call also
    // preallocates enough buffer to hold the prefix and payload for this entry
    this.writer.align(4, 4 + dataLength);
    // parameterId
    this.writer.uint16(id);
    // parameterLength, includes any padding suffix bytes needed to align the
    // next entry to a 4-byte boundary
    const alignment = (this.writer.size + 2 + dataLength) % 4;
    const padding = alignment > 0 ? 4 - alignment : 0;
    const parameterLength = dataLength + padding;
    this.writer.uint16(parameterLength);
  }
}
