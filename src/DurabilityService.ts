import { CdrReader } from "@foxglove/cdr";
import { Time } from "@foxglove/rostime";

import { History } from "./enums";

export class DurabilityService {
  constructor(
    public leaseDuration: Time,
    public historyKind: History,
    public historyDepth: number,
    public maxSamples: number,
    public maxInstances: number,
    public maxSamplesPerInstance: number,
  ) {}

  static fromCDR(reader: CdrReader): DurabilityService {
    const leaseDuration = { sec: reader.int32(), nsec: reader.uint32() };
    const historyKind = reader.uint32() as History;
    const historyDepth = reader.int32();
    const maxSamples = reader.int32();
    const maxInstances = reader.int32();
    const maxSamplesPerInstance = reader.int32();
    return new DurabilityService(
      leaseDuration,
      historyKind,
      historyDepth,
      maxSamples,
      maxInstances,
      maxSamplesPerInstance,
    );
  }
}
