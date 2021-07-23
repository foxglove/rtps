import { Endpoint } from "./Endpoint";
import { EntityId } from "./EntityId";
import { RtpsParticipantView } from "./RtpsParticipantView";
import { DiscoveredTopicData } from "./types";

export type TopicOpts = {
  participant: RtpsParticipantView;
  readerEntityId: EntityId;
  writerEntityId: EntityId;
  topicData: DiscoveredTopicData;
};

export class Topic extends Endpoint {
  topicData: DiscoveredTopicData;

  constructor(opts: TopicOpts) {
    super(opts);
    this.topicData = opts.topicData;
  }
}
