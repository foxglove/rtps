import { Guid, makeGuid } from "../common";
import { EndpointAttributes } from "./Endpoint";

export class WriterView {
  attributes: Readonly<EndpointAttributes>;
  firstAvailableSeqNum = 1n;
  lastSeqNum = 0n;

  constructor(attributes: EndpointAttributes) {
    this.attributes = attributes;
  }

  guid(): Guid {
    return makeGuid(this.attributes.guidPrefix, this.attributes.entityId);
  }
}
