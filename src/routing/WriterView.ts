import { EndpointAttributes } from "./Endpoint";

export class WriterView {
  attributes: Readonly<EndpointAttributes>;
  firstAvailableSeqNum = 1n;
  lastSeqNum = 0n;

  constructor(attributes: EndpointAttributes) {
    this.attributes = attributes;
  }
}
