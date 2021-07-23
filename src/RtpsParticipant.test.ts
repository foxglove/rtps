import { RtpsParticipant } from "./RtpsParticipant";
import { getNetworkInterfaces, UdpSocketNode } from "./nodejs";
import { selectIPv4 } from "./selectIP";

jest.setTimeout(1000 * 10);

describe("RtpsParticipant", () => {
  it("should work", async () => {
    const address = selectIPv4(getNetworkInterfaces());
    const participant = new RtpsParticipant({
      name: "test",
      addresses: [address],
      participantId: 1,
      udpSocketCreate: UdpSocketNode.Create,
      // log: console,
    });
    await participant.start();
    expect(participant.defaultUnicastSocket).toBeDefined();
    participant.shutdown();
  });
});
