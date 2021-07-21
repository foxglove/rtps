import { CdrWriter, EncapsulationKind } from "@foxglove/cdr";
import { Duration } from "@foxglove/rostime";

import { Guid } from "./Guid";
import { Locator } from "./Locator";
import { ParameterId } from "./ParameterId";
import { BuiltinEndpointSet, VendorId } from "./enums";
import { ProtocolVersion } from "./types";

const textEncoder = new TextEncoder();

export class Parameters {
  private writer = new CdrWriter({ kind: EncapsulationKind.PL_CDR_LE, size: 256 });

  get data(): Uint8Array {
    return this.writer.data;
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
    this.writer.uint32(value.nsec);
    this.writer.align(4);
  }

  participantGuid(value: Guid): void {
    const length = 16;
    this.writePrefix(ParameterId.PID_PARTICIPANT_GUID, length);
    value.toCDR(this.writer);
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
  }

  private writePrefix(id: ParameterId, dataLength: number): void {
    // Align to a 4-byte boundary and preallocate enough buffer to hold the
    // prefix and payload for this entry
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
