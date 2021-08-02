import { Participant, selectIPv4, DiscoveredParticipantData } from "../src";
import { getNetworkInterfaces, UdpSocketNode } from "../src/nodejs";

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

  const other = await new Promise<DiscoveredParticipantData>((resolve, reject) => {
    participant.once("discoveredParticipant", resolve);
    participant.once("error", reject);
  });

  participant.on("discoveredEndpoint", (endpoint) => {
    console.dir(endpoint);
  });

  console.dir(other);

  await participant.sendParticipantData(other.guidPrefix);

  await new Promise((r) => setTimeout(r, 10000));

  participant.shutdown();
}

void main();
