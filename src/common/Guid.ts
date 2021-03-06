import { CdrReader, CdrWriter } from "@foxglove/cdr";

import {
  EntityId,
  entityIdFromCDR,
  entityIdFromString,
  entityIdToString,
  writeEntityId,
  writeEntityIdToCDR,
} from "./EntityId";
import { GuidPrefix, guidPrefixFromCDR, writeGuidPrefix, writeGuidPrefixToCDR } from "./GuidPrefix";

export type Guid = string; // 32 hex characters

export function makeGuid(guidPrefix: GuidPrefix, entityId: EntityId): Guid {
  return guidPrefix + entityIdToString(entityId);
}

export function guidFromCDR(reader: CdrReader): Guid {
  const guidPrefix = guidPrefixFromCDR(reader);
  const entityId = entityIdFromCDR(reader);
  return makeGuid(guidPrefix, entityId);
}

export function writeGuid(guid: Guid, output: DataView, offset: number): void {
  if (guid.length !== 32) {
    throw new Error(`invalid GUID "${guid}"`);
  }

  const guidPrefix = guid.slice(0, 24);
  const entityId = entityIdFromString(guid.slice(24, 32));
  writeGuidPrefix(guidPrefix, output, offset);
  writeEntityId(entityId, output, offset + 12);
}

export function writeGuidToCDR(guid: Guid, output: CdrWriter): void {
  if (guid.length !== 32) {
    throw new Error(`invalid GUID "${guid}"`);
  }

  const guidPrefix = guid.slice(0, 24);
  const entityId = entityIdFromString(guid.slice(24, 32));
  writeGuidPrefixToCDR(guidPrefix, output);
  writeEntityIdToCDR(entityId, output);
}

export function guidParts(guid: Guid): [guidPrefix: GuidPrefix, entityId: EntityId] {
  if (guid.length !== 32) {
    throw new Error(`invalid GUID "${guid}"`);
  }

  const guidPrefix = guid.slice(0, 24);
  const entityId = entityIdFromString(guid.slice(24, 32));
  return [guidPrefix, entityId];
}
