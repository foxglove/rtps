export enum EncapsulationKind {
  CDR_BE = 0x0000,
  CDR_LE = 0x0001,
  PL_CDR_BE = 0x0002,
  PL_CDR_LE = 0x0003,
}

export enum Liveliness {
  Automatic = 0,
  ByParticipant = 1,
  ByTopic = 2,
}

export enum Durability {
  Volatile = 0,
  TransientLocal = 1,
  Transient = 2,
  Persistent = 3,
}

export enum Reliability {
  BestEffort = 1,
  Reliable = 2,
}

export enum HistoryKind {
  KeepLast = 0,
  KeepAll = 1,
}

export enum EntityKind {
  AppdefUnknown = 0x00,
  AppdefParticipant = 0x01,
  AppdefWriterWithKey = 0x02,
  AppdefWriterNoKey = 0x03,
  AppdefReaderNoKey = 0x04,
  AppdefReaderWithKey = 0x07,
  BuiltinParticipant = 0xc1,
  BuiltinWriterWithKey = 0xc2,
  BuiltinWriterNoKey = 0xc3,
  BuiltinReaderNoKey = 0xc4,
  BuiltinReaderWithKey = 0xc7,
}

export enum ParameterOwnership {
  Shared = 0,
  Exclusive = 1,
}

export enum ParameterPresentation {
  Instance = 0,
  Topic = 1,
  Group = 2,
}

export enum EntityIdBuiltin {
  Unknown = 0,
  Participant = 0x0001c1, // makeEntityId(0x0001, EntityKind.BuiltinParticipant);
  PublicationsReader = 0x0003c7, // makeEntityId(0x0003, EntityKind.BuiltinReaderWithKey);
  PublicationsWriter = 0x0003c2, // makeEntityId(0x0003, EntityKind.BuiltinWriterWithKey);
  SubscriptionsReader = 0x0004c7, // makeEntityId(0x0004, EntityKind.BuiltinReaderWithKey);
  SubscriptionsWriter = 0x0004c2, // makeEntityId(0x0004, EntityKind.BuiltinWriterWithKey);
  ParticipantReader = 0x0100c7, // makeEntityId(0x0100, EntityKind.BuiltinReaderWithKey);
  ParticipantWriter = 0x0100c2, // makeEntityId(0x0100, EntityKind.BuiltinWriterWithKey);
  ParticipantMessageReader = 0x0200c7, // makeEntityId(0x0200, EntityKind.BuiltinReaderWithKey);
  ParticipantMessageWriter = 0x0200c2, // makeEntityId(0x0200, EntityKind.BuiltinWriterWithKey);
  TypeLookupRequestReader = 0x0300c4, // makeEntityId(0x0300, EntityKind.BuiltinReaderNoKey);
  TypeLookupRequestWriter = 0x0300c3, // makeEntityId(0x0300, EntityKind.BuiltinWriterNoKey);
  TypeLookupReplyReader = 0x0301c4, // makeEntityId(0x0301, EntityKind.BuiltinReaderNoKey);
  TypeLookupReplyWriter = 0x0301c3, // makeEntityId(0x0301, EntityKind.BuiltinWriterNoKey);
}

export enum BuiltinEndpointSet {
  ParticipantAnnouncer = 1 << 0,
  ParticipantDetector = 1 << 1,
  PublicationAnnouncer = 1 << 2,
  PublicationDetector = 1 << 3,
  SubscriptionAnnouncer = 1 << 4,
  SubscriptionDetector = 1 << 5,
  ParticipantProxyAnnouncer = 1 << 6,
  ParticipantProxyDetector = 1 << 7,
  ParticipantStateAnnouncer = 1 << 8,
  ParticipantStateDetector = 1 << 9,
  ParticipantMessageDataWriter = 1 << 10,
  ParticipantMessageDataReader = 1 << 11,
  TypeLookupRequestDataWriter = 1 << 12,
  TypeLookupRequestDataReader = 1 << 13,
  TypeLookupReplyDataWriter = 1 << 14,
  TypeLookupReplyDataReader = 1 << 15,
}

export enum LocatorKind {
  Invalid = -1,
  Reserved = 0,
  UDPv4 = 1,
  UDPv6 = 2,
  Unknown = 16,
}

export enum VendorId {
  Unknown = 0x0000, // Unknown vendor ID
  RTIConnextDDS = 0x0101, // RTI Connext DDS - Real-Time Innovations, Inc. (RTI)
  OpenSpliceDDS = 0x0102, // OpenSplice DDS - ADLink Ltd.
  OpenDDS = 0x0103, // OpenDDS - Object Computing Inc. (OCI)
  MilDDS = 0x0104, // Mil-DDS	- MilSoft
  InterCOMDDS = 0x0105, // InterCOM DDS - Kongsberg
  CoreDXDDS = 0x0106, // CoreDX DDS - TwinOaks Computing, Inc.
  NotActive1 = 0x0107, // Not Active - Lakota Technical Solutions, Inc.
  NotActive2 = 0x0108, // Not Active - ICOUP Consulting
  DiamondDDS = 0x0109, // Diamond DDS - Electronics and Telecommunication Research Institute (ETRI)
  RTIConntextDDSMicro = 0x010a, // RTI Connext DDS Micro - Real-Time Innovations, Inc. (RTI)
  VortexCafe = 0x010b, // Vortex Cafe - ADLink Ltd.
  NotActive3 = 0x010c, // Not Active - PrismTech Ltd.
  VortexLite = 0x010d, // Vortex Lite - ADLink Ltd.
  Qeo = 0x010e, // Qeo - Technicolor
  FastRTPSFastDDS = 0x010f, // FastRTPS, FastDDS - eProsima
  EclipseCycloneDDS = 0x0110, // Eclipse Cyclone DDS - Eclipse Foundation
  GurumDDS = 0x0111, // GurumDDS - Gurum Networks, Inc.
  RustDDS = 0x0112, // RustDDS - Atostek
}

export enum ChangeKind {
  Alive = 1 << 0,
  NotAliveDisposed = 1 << 1,
  NotAliveUnregistered = 1 << 2,
}

export enum ParameterId {
  PID_PAD = 0x0000,
  PID_SENTINEL = 0x0001,
  PID_USER_DATA = 0x002c,
  PID_TOPIC_NAME = 0x0005,
  PID_TYPE_NAME = 0x0007,
  PID_GROUP_DATA = 0x002d,
  PID_TOPIC_DATA = 0x002e,
  PID_DURABILITY = 0x001d,
  PID_DURABILITY_SERVICE = 0x001e,
  PID_DEADLINE = 0x0023,
  PID_LATENCY_BUDGET = 0x0027,
  PID_LIVELINESS = 0x001b,
  PID_RELIABILITY = 0x001a,
  PID_LIFESPAN = 0x002b,
  PID_DESTINATION_ORDER = 0x0025,
  PID_HISTORY = 0x0040,
  PID_RESOURCE_LIMITS = 0x0041,
  PID_OWNERSHIP = 0x001f,
  PID_OWNERSHIP_STRENGTH = 0x0006,
  PID_PRESENTATION = 0x0021,
  PID_PARTITION = 0x0029,
  PID_TIME_BASED_FILTER = 0x0004,
  PID_TRANSPORT_PRIORITY = 0x0049,
  PID_PROTOCOL_VERSION = 0x0015,
  PID_VENDORID = 0x0016,
  PID_UNICAST_LOCATOR = 0x002f,
  PID_MULTICAST_LOCATOR = 0x0030,
  PID_MULTICAST_IPADDRESS = 0x0011,
  PID_DEFAULT_UNICAST_LOCATOR = 0x0031,
  PID_DEFAULT_MULTICAST_LOCATOR = 0x0048,
  PID_METATRAFFIC_UNICAST_LOCATOR = 0x0032,
  PID_METATRAFFIC_MULTICAST_LOCATOR = 0x0033,
  PID_DEFAULT_UNICAST_IPADDRESS = 0x000c,
  PID_DEFAULT_UNICAST_PORT = 0x000e,
  PID_METATRAFFIC_UNICAST_IPADDRESS = 0x0045,
  PID_METATRAFFIC_UNICAST_PORT = 0x000d,
  PID_METATRAFFIC_MULTICAST_IPADDRESS = 0x000b,
  PID_METATRAFFIC_MULTICAST_PORT = 0x0046,
  PID_EXPECTS_INLINE_QOS = 0x0043,
  PID_PARTICIPANT_MANUAL_LIVELINESS_COUNT = 0x0034,
  PID_PARTICIPANT_BUILTIN_ENDPOINTS = 0x0044,
  PID_PARTICIPANT_LEASE_DURATION = 0x0002,
  PID_CONTENT_FILTER_PROPERTY = 0x0035,
  PID_PARTICIPANT_GUID = 0x0050,
  PID_PARTICIPANT_ENTITYID = 0x0051,
  PID_GROUP_GUID = 0x0052,
  PID_GROUP_ENTITYID = 0x0053,
  PID_BUILTIN_ENDPOINT_SET = 0x0058,
  PID_PROPERTY_LIST = 0x0059,
  PID_TYPE_MAX_SIZE_SERIALIZED = 0x0060,
  PID_ENTITY_NAME = 0x0062,
  PID_KEY_HASH = 0x0070,
  PID_STATUS_INFO = 0x0071,
  PID_ENDPOINT_GUID = 0x005a,
  PID_CONTENT_FILTER_INFO = 0x0055,
  PID_COHERENT_SET = 0x0056,
  PID_DIRECTED_WRITE = 0x0057,
  PID_ORIGINAL_WRITER_INFO = 0x0061,

  PID_TYPE_OBJECT = 0x0072,
  PID_DATA_REPRESENTATION = 0x0073,
  PID_TYPE_CONSISTENCY = 0x0074, // aka PID_XTYPES_TYPE_CONSISTENCY
  PID_EQUIVALENT_TYPE_NAME = 0x0075, // aka PID_XTYPES_TYPE_INFORMATION
  PID_BASE_TYPE_NAME = 0x0076,
  PID_BUILTIN_ENDPOINT_QOS = 0x0077,
  PID_ENABLE_AUTHENTICATION = 0x0078,
  PID_DOMAIN_ID = 0x000f,
  PID_DOMAIN_TAG = 0x4014,
  PID_ADLINK_PARTICIPANT_VERSION_INFO = 0x8007,
  PID_ADLINK_ENTITY_FACTORY = 0x800c,
  PID_SAMPLE_SIGNATURE = 0x8019,
}

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

export const LittleEndian = 1;
