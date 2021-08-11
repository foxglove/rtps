import { HistoryCache } from "../history";
import { Endpoint, EndpointAttributes } from "./Endpoint";

export class Reader implements Endpoint {
  readonly attributes: Readonly<EndpointAttributes>;
  history = new HistoryCache();
  count = 0;

  constructor(attributes: EndpointAttributes) {
    this.attributes = attributes;
  }
}
