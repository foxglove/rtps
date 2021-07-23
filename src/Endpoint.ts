import { EntityId } from "./EntityId";
import { HistoryCache } from "./HistoryCache";

export class Endpoint {
  readerEntityId: EntityId;
  writerEntityId: EntityId;
  history: HistoryCache;
  ackNackCount = 0;

  constructor(readerEntityId: EntityId, writerEntityId: EntityId) {
    this.readerEntityId = readerEntityId;
    this.writerEntityId = writerEntityId;
    this.history = new HistoryCache();
  }
}
