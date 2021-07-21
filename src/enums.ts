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

export enum History {
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
}

export enum LocatorKind {
  Invalid = -1,
  Reserved = 0,
  UDPv4 = 1,
  UDPv6 = 2,
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
