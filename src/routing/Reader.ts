import { ReaderHistoryCache } from "../history";
import { EndpointAttributes } from "./Endpoint";

export class Reader {
  readonly attributes: Readonly<EndpointAttributes>;
  history: ReaderHistoryCache;
  count = 0;

  constructor(attributes: EndpointAttributes) {
    this.attributes = attributes;
    this.history = new ReaderHistoryCache(attributes);
  }
}
