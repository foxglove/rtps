import { SequenceNumberSet } from "../common";
import { EndpointAttributes } from "./Endpoint";

export class ReaderView {
  attributes: Readonly<EndpointAttributes>;
  readerSNState = new SequenceNumberSet(0n, 0);
  count = 0;

  constructor(attributes: EndpointAttributes) {
    this.attributes = attributes;
  }
}
