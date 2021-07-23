import { EntityId } from "./EntityId";
import { HistoryCache } from "./HistoryCache";
import { RtpsParticipantView } from "./RtpsParticipantView";

export type EndpointOpts = {
  participant: RtpsParticipantView;
  readerEntityId: EntityId;
  writerEntityId: EntityId;
};

export class Endpoint {
  participant: RtpsParticipantView;
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
