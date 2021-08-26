import { WriterHistoryCache } from "../history";
import { EndpointAttributes } from "./Endpoint";

export class Writer {
  readonly attributes: Readonly<EndpointAttributes>;
  history: WriterHistoryCache;

  constructor(attributes: EndpointAttributes) {
    this.attributes = attributes;
    this.history = new WriterHistoryCache(attributes);
  }
}
