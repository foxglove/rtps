import { CdrReader, CdrWriter } from "@foxglove/cdr";

import { EntityId } from "./EntityId";
import { GuidPrefix } from "./GuidPrefix";

export class Guid {
  constructor(public guidPrefix: GuidPrefix, public entityId: EntityId) {}

  equals(other: Guid): boolean {
    return this.guidPrefix.equals(other.guidPrefix) && this.entityId.equals(other.entityId);
  }

  toCDR(writer: CdrWriter): void {
    this.guidPrefix.toCDR(writer);
    this.entityId.toCDR(writer);
  }

  toString(): string {
    return this.guidPrefix.toString() + this.entityId.toString();
  }

  static fromCDR(reader: CdrReader): Guid {
    return new Guid(GuidPrefix.fromCDR(reader), EntityId.fromCDR(reader));
  }
}
