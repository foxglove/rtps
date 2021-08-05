import {
  Participant,
  selectIPv4,
  Durability,
  Reliability,
  HistoryKind,
  ParticipantAttributes,
} from "../src";
import { getNetworkInterfaces, UdpSocketNode } from "../src/nodejs";

const DURATION_INFINITE = { sec: 0x7fffffff, nsec: 0xffffffff };

async function main() {
  const address = selectIPv4(getNetworkInterfaces());
  const participant = new Participant({
    name: "listener",
    addresses: [address],
    participantId: 1,
    udpSocketCreate: UdpSocketNode.Create,
    log: console,
  });
  await participant.start();

  participant.on("discoveredPublication", (endpoint) => {
    console.dir(endpoint);
  });

  participant.on("discoveredSubscription", (endpoint) => {
    console.dir(endpoint);
  });

  const other = await new Promise<ParticipantAttributes>((resolve, reject) => {
    participant.once("discoveredParticipant", resolve);
    participant.once("error", reject);
  });

  // console.dir(other);

  await participant.sendParticipantData(other.guidPrefix);

  // await participant.subscribe({
  //   topicName: "ros_discovery_info",
  //   typeName: "rmw_dds_common::msg::dds_::ParticipantEntitiesInfo_",
  //   durability: Durability.TransientLocal,
  //   reliability: { kind: Reliability.Reliable, maxBlockingTime: DURATION_INFINITE },
  //   history: { kind: History.KeepAll, depth: -1 },
  // });
  await participant.subscribe({
    topicName: "rt/chatter",
    typeName: "std_msgs::msg::dds_::String_",
    durability: Durability.TransientLocal,
    reliability: { kind: Reliability.Reliable, maxBlockingTime: DURATION_INFINITE },
    history: { kind: HistoryKind.KeepLast, depth: 10 },
  });

  await participant.sendAlive();

  await new Promise((r) => setTimeout(r, 10000));

  participant.shutdown();
}

void main();
