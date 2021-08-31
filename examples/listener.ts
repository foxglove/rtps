import { Participant, selectIPv4, Durability, Reliability, HistoryKind } from "../src";
import { getNetworkInterfaces, UdpSocketNode } from "../src/nodejs";

const DURATION_INFINITE = { sec: 0x7fffffff, nsec: 0xffffffff };

async function main() {
  const address = selectIPv4(getNetworkInterfaces());
  const participant = new Participant({
    name: "listener",
    addresses: [address],
    udpSocketCreate: UdpSocketNode.Create,
    log: console,
  });
  await participant.start();

  participant.on("discoveredParticipant", (otherParticipant) => {
    console.dir(otherParticipant);
  });

  participant.on("discoveredPublication", (endpoint) => {
    console.dir(endpoint);
  });

  participant.on("discoveredSubscription", (endpoint) => {
    console.dir(endpoint);
  });

  participant.on("userData", (userData) => {
    console.dir(userData);
  });

  const subscribeId = participant.subscribe({
    topicName: "rt/chatter",
    typeName: "std_msgs::msg::dds_::String_",
    durability: Durability.TransientLocal,
    reliability: { kind: Reliability.Reliable, maxBlockingTime: DURATION_INFINITE },
    history: { kind: HistoryKind.KeepLast, depth: 1 },
  });

  await new Promise((r) => setTimeout(r, 10000));

  participant.unsubscribe(subscribeId);

  await new Promise((r) => setTimeout(r, 5000));

  await participant.shutdown();
}

void main();
