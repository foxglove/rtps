import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { uint32ToHex } from "./hex";

export type GuidPrefix = string; // 24 hex characters

export function makeGuidPrefix(hostId: number, appId: number, instanceId: number): GuidPrefix {
  return uint32ToHex(hostId) + uint32ToHex(appId) + uint32ToHex(instanceId);
}

export function generateGuidPrefix(): GuidPrefix {
  const hostId = Math.floor(Math.random() * Math.pow(2, 32));
  const appId = Math.floor(Math.random() * Math.pow(2, 32));
  const instanceId = Math.floor(Math.random() * Math.pow(2, 32));
  return makeGuidPrefix(hostId, appId, instanceId);
}

export function guidPrefixFromData(view: DataView, offset: number): GuidPrefix {
  return makeGuidPrefix(
    view.getUint32(offset, false),
    view.getUint32(offset + 4, false),
    view.getUint32(offset + 8, false),
  );
}

export function guidPrefixFromCDR(reader: CdrReader): GuidPrefix {
  return makeGuidPrefix(reader.uint32BE(), reader.uint32BE(), reader.uint32BE());
}

export function writeGuidPrefix(guidPrefix: GuidPrefix, output: DataView, offset: number): void {
  if (guidPrefix.length !== 24) {
    throw new Error(`Invalid guidPrefix "${guidPrefix}"`);
  }
  const hostId = parseInt(guidPrefix.slice(0, 8), 16);
  const appId = parseInt(guidPrefix.slice(8, 16), 16);
  const instanceId = parseInt(guidPrefix.slice(16, 24), 16);

  output.setUint32(offset, hostId, false);
  output.setUint32(offset + 4, appId, false);
  output.setUint32(offset + 8, instanceId, false);
}

export function writeGuidPrefixToCDR(guidPrefix: GuidPrefix, output: CdrWriter): void {
  if (guidPrefix.length !== 24) {
    throw new Error(`Invalid guidPrefix "${guidPrefix}"`);
  }
  const hostId = parseInt(guidPrefix.slice(0, 8), 16);
  const appId = parseInt(guidPrefix.slice(8, 16), 16);
  const instanceId = parseInt(guidPrefix.slice(16, 24), 16);

  output.uint32BE(hostId);
  output.uint32BE(appId);
  output.uint32BE(instanceId);
}
