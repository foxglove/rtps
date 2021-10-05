import {
  EntityIdBuiltin,
  Guid,
  guidParts,
  hasBuiltinEndpoint,
  VendorId,
  BuiltinEndpointSet,
  Durability,
  HistoryKind,
  LocatorKind,
  Reliability,
  SubMessageId,
  ParameterId,
} from "../common";
import { MessageView } from "./MessageView";
import { ParametersView } from "./ParametersView";
import { DataMsgView, InfoTsView } from "./submessages";

describe("MessageView", () => {
  it("parses an example RTPS message", () => {
    const data = new Uint8Array([
      0x52, 0x54, 0x50, 0x53, 0x02, 0x01, 0x01, 0x10, 0x5a, 0xb8, 0x10, 0x01, 0x16, 0x36, 0xc7,
      0xd5, 0x18, 0x95, 0xc5, 0x4e, 0x09, 0x01, 0x08, 0x00, 0xb3, 0xee, 0xe9, 0x60, 0xbc, 0xb4,
      0xe1, 0x48, 0x15, 0x05, 0xf8, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0xc2, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00,
      0x2c, 0x00, 0x10, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x65, 0x6e, 0x63, 0x6c, 0x61, 0x76, 0x65,
      0x3d, 0x2f, 0x3b, 0x00, 0x00, 0x15, 0x00, 0x04, 0x00, 0x02, 0x01, 0x00, 0x00, 0x16, 0x00,
      0x04, 0x00, 0x01, 0x10, 0x00, 0x00, 0x02, 0x00, 0x08, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x50, 0x00, 0x10, 0x00, 0x5a, 0xb8, 0x10, 0x01, 0x16, 0x36, 0xc7, 0xd5,
      0x18, 0x95, 0xc5, 0x4e, 0x00, 0x00, 0x01, 0xc1, 0x58, 0x00, 0x04, 0x00, 0x3f, 0x0c, 0x00,
      0x00, 0x0f, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x31, 0x00, 0x18, 0x00, 0x01, 0x00,
      0x00, 0x00, 0xd8, 0xe4, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x2e, 0x32, 0x00, 0x18, 0x00, 0x01, 0x00, 0x00, 0x00,
      0xd8, 0xe4, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x0a, 0x00, 0x00, 0x2e, 0x07, 0x80, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c,
      0x00, 0x00, 0x00, 0x4a, 0x6f, 0x68, 0x6e, 0x73, 0x2d, 0x4d, 0x61, 0x63, 0x42, 0x6f, 0x6f,
      0x6b, 0x2d, 0x50, 0x72, 0x6f, 0x2e, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x2f, 0x30, 0x2e, 0x38,
      0x2e, 0x30, 0x2f, 0x44, 0x61, 0x72, 0x77, 0x69, 0x6e, 0x2f, 0x44, 0x61, 0x72, 0x77, 0x69,
      0x6e, 0x00, 0x19, 0x80, 0x04, 0x00, 0x00, 0x00, 0x10, 0x00, 0x01, 0x00, 0x00, 0x00,
    ]);
    const view = new MessageView(data);
    expect(view.data).toBe(data);
    expect(view.protocolVersion).toEqual({ major: 2, minor: 1 });
    expect(view.vendorId).toEqual(VendorId.EclipseCycloneDDS);
    expect(view.guidPrefix).toEqual("5ab810011636c7d51895c54e");
    const subMessages = view.subMessages();
    expect(subMessages).toHaveLength(2);

    const infoTs = subMessages[0]! as InfoTsView;
    expect(infoTs instanceof InfoTsView).toEqual(true);
    expect(infoTs.data).toBe(data);
    expect(infoTs.view).toBeDefined();
    expect(infoTs.offset).toEqual(20);
    expect(infoTs.submessageId).toEqual(SubMessageId.INFO_TS);
    expect(infoTs.littleEndian).toEqual(true);
    expect(infoTs.octetsToNextHeader).toEqual(8);
    expect(infoTs.timestamp).toEqual({ sec: 1625943731, nsec: 1222751420 });

    const dataMsg = subMessages[1]! as DataMsgView;
    expect(dataMsg instanceof DataMsgView).toEqual(true);
    expect(dataMsg.data).toBe(data);
    expect(dataMsg.view).toBeDefined();
    expect(dataMsg.offset).toEqual(32);
    expect(dataMsg.submessageId).toEqual(SubMessageId.DATA);
    expect(dataMsg.littleEndian).toEqual(true);
    expect(dataMsg.octetsToNextHeader).toEqual(248);
    expect(dataMsg.readerEntityId).toEqual(0);
    expect(dataMsg.writerEntityId).toEqual(EntityIdBuiltin.ParticipantWriter);
    expect(dataMsg.writerSeqNumber).toEqual(1n);
    expect(dataMsg.serializedData[0]).toEqual(0);
    expect(dataMsg.serializedData[1]).toEqual(3);
    expect(dataMsg.serializedData[2]).toEqual(0);
    expect(dataMsg.serializedData[3]).toEqual(0);
    expect(dataMsg.serializedData).toHaveLength(224);
    expect(dataMsg.serializedData).toEqual(data.slice(56, 56 + 224));
    expect(dataMsg.effectiveTimestamp).toEqual({ sec: 1625943731, nsec: 1222751420 });

    let params = ParametersView.FromCdr(dataMsg.serializedData)!;
    expect(params).toBeDefined();
    expect(params.allParameters().size).toEqual(11);
    params = ParametersView.FromCdr(dataMsg.serializedData)!;
    expect(params.allParameters().size).toEqual(11);

    const allParams = params.allParameters();
    const userData = allParams.get(ParameterId.PID_USER_DATA) as Uint8Array;
    expect(new TextDecoder().decode(userData)).toEqual("enclave=/;");
    expect(allParams.get(ParameterId.PID_PROTOCOL_VERSION)).toEqual({ major: 2, minor: 1 });
    expect(allParams.get(ParameterId.PID_VENDORID)).toEqual(VendorId.EclipseCycloneDDS);
    expect(allParams.get(ParameterId.PID_PARTICIPANT_LEASE_DURATION)).toEqual({ sec: 10, nsec: 0 });
    expect(guidParts(allParams.get(ParameterId.PID_PARTICIPANT_GUID) as Guid)).toEqual([
      "5ab810011636c7d51895c54e",
      EntityIdBuiltin.Participant,
    ]);
    const endpointSet = allParams.get(ParameterId.PID_BUILTIN_ENDPOINT_SET) as BuiltinEndpointSet;
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.ParticipantAnnouncer)).toEqual(true);
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.ParticipantDetector)).toEqual(true);
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.PublicationAnnouncer)).toEqual(true);
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.PublicationDetector)).toEqual(true);
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.SubscriptionAnnouncer)).toEqual(true);
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.SubscriptionDetector)).toEqual(true);
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.ParticipantProxyAnnouncer)).toEqual(false); // prettier-ignore
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.ParticipantProxyDetector)).toEqual(false); // prettier-ignore
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.ParticipantStateAnnouncer)).toEqual(false); // prettier-ignore
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.ParticipantStateDetector)).toEqual(false); // prettier-ignore
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.ParticipantMessageDataWriter)).toEqual(true); // prettier-ignore
    expect(hasBuiltinEndpoint(endpointSet, BuiltinEndpointSet.ParticipantMessageDataReader)).toEqual(true); // prettier-ignore
    expect(allParams.get(ParameterId.PID_DOMAIN_ID)).toEqual(0);
    expect(allParams.get(ParameterId.PID_DEFAULT_UNICAST_LOCATOR)).toEqual([
      {
        kind: LocatorKind.UDPv4,
        port: 58584,
        address: "10.0.0.46",
      },
    ]);
    expect(allParams.get(ParameterId.PID_METATRAFFIC_UNICAST_LOCATOR)).toEqual([
      {
        kind: LocatorKind.UDPv4,
        port: 58584,
        address: "10.0.0.46",
      },
    ]);
    expect(allParams.get(ParameterId.PID_ADLINK_PARTICIPANT_VERSION_INFO)).toEqual("Johns-MacBook-Pro.local/0.8.0/Darwin/Darwin"); // prettier-ignore
    expect(allParams.get(ParameterId.PID_SAMPLE_SIGNATURE)).toEqual(new Uint8Array([0, 0, 0x10, 0])); // prettier-ignore
    expect(allParams.get(ParameterId.PID_SENTINEL)).toEqual(undefined);
  });

  it("parses another example RTPS message", () => {
    const data = new Uint8Array([
      0x52, 0x54, 0x50, 0x53, 0x02, 0x01, 0x01, 0x10, 0x54, 0xa6, 0x10, 0x01, 0x31, 0x98, 0x43,
      0xec, 0xa3, 0x66, 0x9a, 0x35, 0x09, 0x01, 0x08, 0x00, 0xb7, 0xee, 0xe9, 0x60, 0x6d, 0xcc,
      0xeb, 0x70, 0x15, 0x05, 0xdc, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x03, 0xc2, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00,
      0x05, 0x00, 0x10, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x72, 0x74, 0x2f, 0x72, 0x6f, 0x73, 0x6f,
      0x75, 0x74, 0x00, 0x00, 0x00, 0x07, 0x00, 0x24, 0x00, 0x20, 0x00, 0x00, 0x00, 0x72, 0x63,
      0x6c, 0x5f, 0x69, 0x6e, 0x74, 0x65, 0x72, 0x66, 0x61, 0x63, 0x65, 0x73, 0x3a, 0x3a, 0x6d,
      0x73, 0x67, 0x3a, 0x3a, 0x64, 0x64, 0x73, 0x5f, 0x3a, 0x3a, 0x4c, 0x6f, 0x67, 0x5f, 0x00,
      0x1d, 0x00, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1e, 0x00, 0x1c, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xe8, 0x03, 0x00, 0x00, 0xff, 0xff,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1a, 0x00, 0x0c, 0x00, 0x02,
      0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x7f, 0xff, 0xff, 0xff, 0xff, 0x2b, 0x00, 0x08, 0x00,
      0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00,
      0x00, 0xe8, 0x03, 0x00, 0x00, 0x15, 0x00, 0x04, 0x00, 0x02, 0x01, 0x00, 0x00, 0x16, 0x00,
      0x04, 0x00, 0x01, 0x10, 0x00, 0x00, 0x5a, 0x00, 0x10, 0x00, 0x54, 0xa6, 0x10, 0x01, 0x31,
      0x98, 0x43, 0xec, 0xa3, 0x66, 0x9a, 0x35, 0x00, 0x00, 0x06, 0x03, 0x0c, 0x80, 0x04, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x03, 0x80, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
      0x00,
    ]);
    const view = new MessageView(data);
    expect(view.data).toBe(data);
    expect(view.protocolVersion).toEqual({ major: 2, minor: 1 });
    expect(view.vendorId).toEqual(VendorId.EclipseCycloneDDS);
    expect(view.guidPrefix).toEqual("54a61001319843eca3669a35");
    const subMessages = view.subMessages();
    expect(subMessages).toHaveLength(2);

    const dataMsg = subMessages[1]! as DataMsgView;
    const allParams = ParametersView.FromCdr(dataMsg.serializedData)!.allParameters();
    expect(allParams.get(ParameterId.PID_TOPIC_NAME)).toEqual("rt/rosout");
    expect(allParams.get(ParameterId.PID_TYPE_NAME)).toEqual("rcl_interfaces::msg::dds_::Log_");
    expect(allParams.get(ParameterId.PID_DURABILITY)).toEqual(Durability.TransientLocal);
    expect(allParams.get(ParameterId.PID_DURABILITY_SERVICE)).toEqual({
      leaseDuration: { sec: 0, nsec: 0 },
      historyKind: HistoryKind.KeepLast,
      historyDepth: 1000,
      maxSamples: -1,
      maxInstances: -1,
      maxSamplesPerInstance: -1,
    });
    expect(allParams.get(ParameterId.PID_RELIABILITY)).toEqual({
      kind: Reliability.Reliable,
      maxBlockingTime: { nsec: 4294967295, sec: 2147483647 },
    });
    expect(allParams.get(ParameterId.PID_LIFESPAN)).toEqual({ sec: 10, nsec: 0 });
    expect(allParams.get(ParameterId.PID_HISTORY)).toEqual({
      kind: HistoryKind.KeepLast,
      depth: 1000,
    });
    expect(allParams.get(ParameterId.PID_PROTOCOL_VERSION)).toEqual({ major: 2, minor: 1 });
    expect(allParams.get(ParameterId.PID_VENDORID)).toEqual(VendorId.EclipseCycloneDDS);
    expect(guidParts(allParams.get(ParameterId.PID_ENDPOINT_GUID) as Guid)).toEqual([
      "54a61001319843eca3669a35",
      0x000603,
    ]);
    expect(allParams.get(ParameterId.PID_ADLINK_ENTITY_FACTORY)).toEqual(new Uint8Array([1, 0, 0, 0])); // prettier-ignore
    expect(allParams.get(0x8003)).toEqual(new Uint8Array([0, 0, 0, 0]));
    expect(allParams.get(ParameterId.PID_SENTINEL)).toEqual(undefined);
  });
});
