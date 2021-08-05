import { CdrReader } from "@foxglove/cdr";
import { Duration, Time } from "@foxglove/rostime";

import { DurabilityService } from "./DurabilityService";
import { entityIdFromCDR } from "./EntityId";
import { Guid, guidFromCDR } from "./Guid";
import { Locator } from "./Locator";
import { BuiltinEndpointSet, Durability, History, ParameterId, VendorId } from "./enums";
import { HistoryAndDepth, ProtocolVersion, ReliabilityAndMaxBlockingTime } from "./types";

const textDecoder = new TextDecoder();

export class ParametersView {
  private map: Map<ParameterId, unknown>;

  constructor(reader: CdrReader) {
    this.map = new Map<ParameterId, unknown>();

    let nextOffset = reader.decodedBytes;
    while (nextOffset < reader.data.byteLength) {
      reader.seekTo(nextOffset);
      const parameterId = reader.uint16();
      const parameterLength = reader.uint16();
      nextOffset = reader.decodedBytes + parameterLength;
      const value = getParameterValue(parameterId, parameterLength, reader);
      this.map.set(parameterId, value);
    }
  }

  allParameters(): Readonly<Map<ParameterId, unknown>> {
    return this.map;
  }

  userData(): Uint8Array | undefined {
    return this.map.get(ParameterId.PID_USER_DATA) as Uint8Array | undefined;
  }

  userDataString(): string | undefined {
    const data = this.userData();
    if (data == undefined) {
      return undefined;
    }
    return textDecoder.decode(data);
  }

  topicName(): string | undefined {
    return this.map.get(ParameterId.PID_TOPIC_NAME) as string | undefined;
  }

  typeName(): string | undefined {
    return this.map.get(ParameterId.PID_TYPE_NAME) as string | undefined;
  }

  durability(): Durability | undefined {
    return this.map.get(ParameterId.PID_DURABILITY) as Durability | undefined;
  }

  reliability(): ReliabilityAndMaxBlockingTime | undefined {
    return this.map.get(ParameterId.PID_RELIABILITY) as ReliabilityAndMaxBlockingTime | undefined;
  }

  history(): HistoryAndDepth | undefined {
    return this.map.get(ParameterId.PID_HISTORY) as HistoryAndDepth | undefined;
  }

  builtinEndpointSet(): BuiltinEndpointSet | undefined {
    return this.map.get(ParameterId.PID_BUILTIN_ENDPOINT_SET) as BuiltinEndpointSet | undefined;
  }

  protocolVersion(): ProtocolVersion | undefined {
    return this.map.get(ParameterId.PID_PROTOCOL_VERSION) as ProtocolVersion | undefined;
  }

  vendorId(): VendorId | undefined {
    return this.map.get(ParameterId.PID_VENDORID) as VendorId | undefined;
  }

  endpointGuid(): Guid | undefined {
    return this.map.get(ParameterId.PID_ENDPOINT_GUID) as Guid | undefined;
  }

  participantLeaseDuration(): Duration | undefined {
    return this.map.get(ParameterId.PID_PARTICIPANT_LEASE_DURATION) as Duration | undefined;
  }

  participantGuid(): Guid | undefined {
    return this.map.get(ParameterId.PID_PARTICIPANT_GUID) as Guid | undefined;
  }

  participantVersionInfo(): string | undefined {
    return this.map.get(ParameterId.PID_ADLINK_PARTICIPANT_VERSION_INFO) as string | undefined;
  }

  domainId(): number | undefined {
    return this.map.get(ParameterId.PID_DOMAIN_ID) as number | undefined;
  }

  defaultUnicastLocator(): Locator | undefined {
    return this.map.get(ParameterId.PID_DEFAULT_UNICAST_LOCATOR) as Locator | undefined;
  }

  defaultMulticastLocator(): Locator | undefined {
    return this.map.get(ParameterId.PID_DEFAULT_MULTICAST_LOCATOR) as Locator | undefined;
  }

  metatrafficUnicastLocator(): Locator | undefined {
    return this.map.get(ParameterId.PID_METATRAFFIC_UNICAST_LOCATOR) as Locator | undefined;
  }

  metatrafficMulticastLocator(): Locator | undefined {
    return this.map.get(ParameterId.PID_METATRAFFIC_MULTICAST_LOCATOR) as Locator | undefined;
  }

  expectsInlineQoS(): boolean {
    return (this.map.get(ParameterId.PID_EXPECTS_INLINE_QOS) as boolean) ?? false;
  }
}

function getParameterValue(id: ParameterId, length: number, reader: CdrReader): unknown {
  switch (id) {
    case ParameterId.PID_PAD:
      return undefined;
    case ParameterId.PID_SENTINEL:
      return undefined;
    case ParameterId.PID_USER_DATA:
      return reader.uint8Array(reader.sequenceLength());
    case ParameterId.PID_TOPIC_NAME:
      return reader.string();
    case ParameterId.PID_TYPE_NAME:
      return reader.string();
    // case ParameterId.PID_GROUP_DATA:
    // case ParameterId.PID_TOPIC_DATA:
    case ParameterId.PID_DURABILITY:
      return reader.uint32();
    case ParameterId.PID_DURABILITY_SERVICE:
      return DurabilityService.fromCDR(reader);
    // case ParameterId.PID_DEADLINE:
    // case ParameterId.PID_LATENCY_BUDGET:
    // case ParameterId.PID_LIVELINESS:
    case ParameterId.PID_RELIABILITY:
      return { kind: reader.uint32(), maxBlockingTime: readTime(reader) };
    case ParameterId.PID_LIFESPAN:
      return readTime(reader);
    // case ParameterId.PID_DESTINATION_ORDER:
    case ParameterId.PID_HISTORY:
      return { kind: reader.uint32() as History, depth: reader.int32() };
    // case ParameterId.PID_RESOURCE_LIMITS:
    // case ParameterId.PID_OWNERSHIP:
    // case ParameterId.PID_OWNERSHIP_STRENGTH:
    // case ParameterId.PID_PRESENTATION:
    // case ParameterId.PID_PARTITION:
    // case ParameterId.PID_TIME_BASED_FILTER:
    // case ParameterId.PID_TRANSPORT_PRIORITY:
    case ParameterId.PID_PROTOCOL_VERSION:
      return { major: reader.uint8(), minor: reader.uint8() };
    case ParameterId.PID_VENDORID:
      return (reader.uint8() << 8) | reader.uint8();
    case ParameterId.PID_UNICAST_LOCATOR:
      return Locator.fromCDR(reader);
    case ParameterId.PID_MULTICAST_LOCATOR:
      return Locator.fromCDR(reader);
    // case ParameterId.PID_MULTICAST_IPADDRESS:
    case ParameterId.PID_DEFAULT_UNICAST_LOCATOR:
      return Locator.fromCDR(reader);
    case ParameterId.PID_DEFAULT_MULTICAST_LOCATOR:
      return Locator.fromCDR(reader);
    case ParameterId.PID_METATRAFFIC_UNICAST_LOCATOR:
      return Locator.fromCDR(reader);
    case ParameterId.PID_METATRAFFIC_MULTICAST_LOCATOR:
      return Locator.fromCDR(reader);
    // case ParameterId.PID_DEFAULT_UNICAST_IPADDRESS:
    // case ParameterId.PID_DEFAULT_UNICAST_PORT:
    // case ParameterId.PID_METATRAFFIC_UNICAST_IPADDRESS:
    // case ParameterId.PID_METATRAFFIC_UNICAST_PORT:
    // case ParameterId.PID_METATRAFFIC_MULTICAST_IPADDRESS:
    // case ParameterId.PID_METATRAFFIC_MULTICAST_PORT:
    case ParameterId.PID_EXPECTS_INLINE_QOS:
      return reader.uint8() !== 0; // TODO: Check this
    // case ParameterId.PID_PARTICIPANT_MANUAL_LIVELINESS_COUNT:
    // case ParameterId.PID_PARTICIPANT_BUILTIN_ENDPOINTS:
    case ParameterId.PID_PARTICIPANT_LEASE_DURATION:
      return readTime(reader);
    // case ParameterId.PID_CONTENT_FILTER_PROPERTY:
    case ParameterId.PID_PARTICIPANT_GUID:
      return guidFromCDR(reader);
    case ParameterId.PID_PARTICIPANT_ENTITYID:
      return entityIdFromCDR(reader);
    case ParameterId.PID_GROUP_GUID:
      return guidFromCDR(reader);
    case ParameterId.PID_GROUP_ENTITYID:
      return entityIdFromCDR(reader);
    case ParameterId.PID_BUILTIN_ENDPOINT_SET:
      return reader.uint32();
    // case ParameterId.PID_PROPERTY_LIST:
    // case ParameterId.PID_TYPE_MAX_SIZE_SERIALIZED:
    case ParameterId.PID_ENTITY_NAME:
      return reader.string();
    // case ParameterId.PID_KEY_HASH:
    // case ParameterId.PID_STATUS_INFO:
    case ParameterId.PID_ENDPOINT_GUID:
      return guidFromCDR(reader);
    // case ParameterId.PID_CONTENT_FILTER_INFO:
    // case ParameterId.PID_COHERENT_SET:
    // case ParameterId.PID_DIRECTED_WRITE:
    // case ParameterId.PID_ORIGINAL_WRITER_INFO:
    // case ParameterId.PID_TYPE_OBJECT:
    // case ParameterId.PID_DATA_REPRESENTATION:
    // case ParameterId.PID_TYPE_CONSISTENCY:
    // case ParameterId.PID_EQUIVALENT_TYPE_NAME:
    // case ParameterId.PID_BASE_TYPE_NAME:
    // case ParameterId.PID_BUILTIN_ENDPOINT_QOS:
    // case ParameterId.PID_ENABLE_AUTHENTICATION:
    case ParameterId.PID_DOMAIN_ID:
      return reader.uint32();
    // case ParameterId.PID_DOMAIN_TAG:
    case ParameterId.PID_ADLINK_PARTICIPANT_VERSION_INFO:
      reader.seek(20);
      return reader.string();
    // case ParameterId.PID_ADLINK_ENTITY_FACTORY:
    // case ParameterId.PID_SAMPLE_SIGNATURE:
    default:
      return reader.uint8Array(length);
  }
}

function readTime(reader: CdrReader): Time {
  return { sec: reader.int32(), nsec: reader.uint32() };
}
