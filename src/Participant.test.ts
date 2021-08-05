import { Participant } from "./Participant";
import { getNetworkInterfaces, UdpSocketNode } from "./nodejs";
import { selectIPv4 } from "./transport";

jest.setTimeout(1000 * 10);

describe("Participant", () => {
  it("should work", async () => {
    const address = selectIPv4(getNetworkInterfaces());
    const participant = new Participant({
      name: "test",
      addresses: [address],
      participantId: 1,
      udpSocketCreate: UdpSocketNode.Create,
      // log: console,
    });
    await participant.start();
    expect(participant.unicastSocket).toBeDefined();
    participant.shutdown();
  });
});
