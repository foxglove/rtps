import { ParticipantAttributes } from "../ParticipantAttributes";
import { ParticipantView } from "../ParticipantView";
import {
  Durability,
  EntityId,
  HistoryAndDepth,
  LoggerService,
  makeGuid,
  Reliability,
  ReliabilityAndMaxBlockingTime,
} from "../common";
import { EndpointAttributes } from "./Endpoint";
import { Reader } from "./Reader";

export type SubscribeOpts = {
  topicName: string;
  typeName: string;
  durability: Durability;
  reliability: ReliabilityAndMaxBlockingTime;
  history: HistoryAndDepth;
};

export function matchLocalSubscription(
  localAttributes: ParticipantAttributes,
  readerEntityId: EntityId,
  writerEntityId: EntityId,
  subscription: SubscribeOpts,
  participant: ParticipantView,
  log: LoggerService | undefined,
): void {
  const writerView = participant.remoteWriters.get(writerEntityId);
  if (
    writerView == undefined ||
    !subscriptionMatchesPublication(subscription, writerView.attributes)
  ) {
    return;
  }

  const readerGuid = makeGuid(localAttributes.guidPrefix, readerEntityId);
  log?.info?.(
    `creating reader ${readerGuid} -> ${writerView.guid()} for ${subscription.topicName}`,
  );

  const reader = new Reader({
    guidPrefix: localAttributes.guidPrefix,
    entityId: readerEntityId,
    topicName: subscription.topicName,
    typeName: subscription.typeName,
    reliability: subscription.reliability,
    history: subscription.history,
    protocolVersion: localAttributes.protocolVersion,
    vendorId: localAttributes.vendorId,
  });

  participant.localReaders.set(readerEntityId, reader);
  participant.localReaderIdToRemoteWriterId.set(readerEntityId, writerEntityId);
  addToMultiMap(writerEntityId, readerEntityId, participant.remoteWriterIdToLocalReaderIds);
}

export function subscriptionMatchesPublication(
  subscription: SubscribeOpts,
  publication: EndpointAttributes,
): boolean {
  // Check if topic names and type names match
  if (
    publication.topicName !== subscription.topicName ||
    publication.typeName !== subscription.typeName
  ) {
    return false;
  }
  // Publisher Best-Effort is incompatible with Subscriber Reliable
  if (
    publication.reliability.kind === Reliability.BestEffort &&
    subscription.reliability.kind === Reliability.Reliable
  ) {
    return false;
  }
  return true;
}

export function addToMultiMap(
  key: EntityId,
  value: EntityId,
  map: Map<EntityId, EntityId[]>,
): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}
