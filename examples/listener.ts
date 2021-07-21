import { RtpsParticipant, selectIPv4, SpdpDiscoveredParticipantData } from "../src";
import { getNetworkInterfaces, UdpSocketNode } from "../src/nodejs";

async function main() {
  const address = selectIPv4(getNetworkInterfaces());
  const participant = new RtpsParticipant({
    name: "listener",
    addresses: [address],
    participantId: 1,
    udpSocketCreate: UdpSocketNode.Create,
    log: console,
  });
  await participant.start();

  const other = await new Promise<SpdpDiscoveredParticipantData>((resolve, reject) => {
    participant.once("discoveredParticipant", resolve);
    participant.once("error", reject);
  });

  console.dir(other);
  const locator = other.metatrafficUnicastLocatorList[0]!;

  await participant.sendParticipantData(locator, other.guidPrefix);

  await new Promise((r) => setTimeout(r, 10000));

  participant.shutdown();
}

void main();
