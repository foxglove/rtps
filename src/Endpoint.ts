import { EntityId } from "./EntityId";
import { HistoryCache } from "./HistoryCache";
import { ParticipantView } from "./ParticipantView";

export type EndpointOpts = {
  participant: ParticipantView;
  readerEntityId: EntityId;
  writerEntityId: EntityId;
};

export class Endpoint {
  participant: ParticipantView;
  readerEntityId: EntityId;
  writerEntityId: EntityId;
  history: HistoryCache;

  constructor(opts: EndpointOpts) {
    this.participant = opts.participant;
    this.readerEntityId = opts.readerEntityId;
    this.writerEntityId = opts.writerEntityId;
    this.history = new HistoryCache();
  }
}
