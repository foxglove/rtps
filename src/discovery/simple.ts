import { Time } from "@foxglove/rostime";

import { ParticipantAttributes } from "../ParticipantAttributes";
import { guidParts, HistoryKind, Locator, LocatorKind } from "../common";
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

  const metatrafficUnicastLocatorList = filterLocators(metatrafficUnicastLocator);
  const metatrafficMulticastLocatorList = filterLocators(metatrafficMulticastLocator);
  const defaultUnicastLocatorList = filterLocators(defaultUnicastLocator);
  const defaultMulticastLocatorList = filterLocators(defaultMulticastLocator);

  if (defaultUnicastLocatorList.length === 0) {
    return undefined;
  }

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
  const history = params.history() ?? { kind: HistoryKind.KeepLast, depth: 1 };
  const protocolVersion = params.protocolVersion();
  const vendorId = params.vendorId();
  const endpointGuid = params.endpointGuid();
  const userData = params.userDataString();

  if (
    topicName == undefined ||
    typeName == undefined ||
    reliability == undefined ||
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

function filterLocators(locators: Locator[]): Locator[] {
  const udp4 = locators.filter((locator) => locator.kind === LocatorKind.UDPv4);
  const udp6 = locators.filter((locator) => locator.kind === LocatorKind.UDPv6);
  return udp4.concat(udp6);
}
