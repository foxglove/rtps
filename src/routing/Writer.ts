import { HistoryCache } from "../history";
import { Endpoint, EndpointAttributes } from "./Endpoint";

export class Writer implements Endpoint {
  readonly attributes: Readonly<EndpointAttributes>;
  history = new HistoryCache();

  constructor(attributes: EndpointAttributes) {
    this.attributes = attributes;
  }
}
