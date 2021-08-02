import { EntityId } from "./EntityId";
import { HistoryCache } from "./HistoryCache";
import { ParticipantView } from "./ParticipantView";
import { DiscoveredEndpointData } from "./types";

export type EndpointOpts = {
  participant: ParticipantView;
  readerEntityId: EntityId;
  writerEntityId: EntityId;
  data: DiscoveredEndpointData;
};

export class Endpoint {
  participant: ParticipantView;
  readerEntityId: EntityId;
  writerEntityId: EntityId;
  data: DiscoveredEndpointData;
  history: HistoryCache;

  constructor(opts: EndpointOpts) {
    this.participant = opts.participant;
    this.readerEntityId = opts.readerEntityId;
    this.writerEntityId = opts.writerEntityId;
    this.data = opts.data;
    this.history = new HistoryCache();
  }
}
