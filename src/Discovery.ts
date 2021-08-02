import { Time } from "@foxglove/rostime";

import { guidParts } from "./Guid";
import { ParametersView } from "./ParametersView";
import { DiscoveredParticipantData, DiscoveredEndpointData } from "./types";

export const MULTICAST_IPv4 = "239.255.0.1";

const builtinMulticastPortOffset = 0;
const userMulticastPortOffset = 1;
const builtinUnicastPortOffset = 10;
const userUnicastPortOffset = 11;
const portBase = 7400;
const domainIDGain = 250;
const participantIDGain = 2;

export function discoveryMulticastPort(domainId: number): number {
  return portBase + domainIDGain * domainId + builtinMulticastPortOffset;
}

export function userMulticastPort(domainId: number): number {
  return portBase + domainIDGain * domainId + userMulticastPortOffset;
}

export function discoveryUnicastPort(domainId: number, participantId: number): number {
  return (
    portBase +
    domainIDGain * domainId +
    builtinUnicastPortOffset +
    participantIDGain * participantId
  );
}

export function userUnicastPort(domainId: number, participantId: number): number {
  return (
    portBase + domainIDGain * domainId + userUnicastPortOffset + participantIDGain * participantId
  );
}

export function parseParticipant(
  params: ParametersView,
  timestamp?: Time,
): DiscoveredParticipantData | undefined {
  const protocolVersion = params.protocolVersion();
  const vendorId = params.vendorId();
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
  params: ParametersView,
  timestamp?: Time,
): DiscoveredEndpointData | undefined {
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
