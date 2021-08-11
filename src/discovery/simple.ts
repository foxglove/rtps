import { Time } from "@foxglove/rostime";

import { ParticipantAttributes } from "../ParticipantAttributes";
import { guidParts } from "../common";
import { ParametersView } from "../messaging";
import { EndpointAttributes } from "../routing";

export function parseParticipant(
  params: ParametersView,
  timestamp?: Time,
): ParticipantAttributes | undefined {
  const protocolVersion = params.protocolVersion();
  const vendorId = params.vendorId();
  const domainId = params.domainId() ?? 0;
  const expectsInlineQoS = params.expectsInlineQoS();
  const metatrafficUnicastLocator = params.metatrafficUnicastLocator();
  const metatrafficMulticastLocator = params.metatrafficMulticastLocator();
  const defaultUnicastLocator = params.defaultUnicastLocator();
  const defaultMulticastLocator = params.defaultMulticastLocator();
  const availableBuiltinEndpoints = params.builtinEndpointSet();
  const leaseDuration = params.participantLeaseDuration();
  const participantGuid = params.participantGuid();
  const userData = params.userDataString();

  if (
    protocolVersion == undefined ||
    vendorId == undefined ||
    availableBuiltinEndpoints == undefined ||
    leaseDuration == undefined ||
    participantGuid == undefined
  ) {
    return undefined;
  }

  const [guidPrefix, entityId] = guidParts(participantGuid);

  const metatrafficUnicastLocatorList =
    metatrafficUnicastLocator != undefined ? [metatrafficUnicastLocator] : [];
  const metatrafficMulticastLocatorList =
    metatrafficMulticastLocator != undefined ? [metatrafficMulticastLocator] : [];
  const defaultUnicastLocatorList =
    defaultUnicastLocator != undefined ? [defaultUnicastLocator] : [];
  const defaultMulticastLocatorList =
    defaultMulticastLocator != undefined ? [defaultMulticastLocator] : [];

  return {
    timestamp,
    guidPrefix,
    entityId,
    protocolVersion,
    vendorId,
    domainId,
    expectsInlineQoS,
    metatrafficUnicastLocatorList,
    metatrafficMulticastLocatorList,
    defaultUnicastLocatorList,
    defaultMulticastLocatorList,
    availableBuiltinEndpoints,
    leaseDuration,
    userData,
  };
}

export function parseEndpoint(
  params?: ParametersView,
  timestamp?: Time,
): EndpointAttributes | undefined {
  if (params == undefined) {
    return undefined;
  }

  const topicName = params.topicName();
  const typeName = params.typeName();
  const reliability = params.reliability();
  const history = params.history();
  const protocolVersion = params.protocolVersion();
  const vendorId = params.vendorId();
  const endpointGuid = params.endpointGuid();
  const userData = params.userDataString();

  if (
    topicName == undefined ||
    typeName == undefined ||
    reliability == undefined ||
    history == undefined ||
    protocolVersion == undefined ||
    vendorId == undefined ||
    endpointGuid == undefined
  ) {
    return undefined;
  }

  const [guidPrefix, entityId] = guidParts(endpointGuid);

  return {
    timestamp,
    guidPrefix,
    entityId,
    topicName,
    typeName,
    reliability,
    history,
    protocolVersion,
    vendorId,
    userData,
  };
}
