import { ChangeKind, HistoryKind } from "../common";
import { ReaderHistoryCache } from "./ReaderHistoryCache";

const writerGuid = "00000000000000000000000000000001";
const empty = new Uint8Array();

describe("ReaderHistoryCache", () => {
  it("handles adding sequentially (no key)", () => {
    const history = new ReaderHistoryCache({
      history: { kind: HistoryKind.KeepLast, depth: 3 },
    });
    let missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(0);
    expect(history.getSequenceNumMin()).toBeUndefined();
    expect(history.getSequenceNumMax()).toBeUndefined();
    expect(history.get(1n)).toBeUndefined();
    expect(missing.size).toEqual(16);
    expect(missing.base).toEqual(1n);
    expect(missing.numBits).toEqual(3);
    expect(missing.bitmap).toEqual(new Uint32Array([3758096384, 0, 0, 0, 0, 0, 0, 0]));

    const firstEntry = {
      timestamp: { sec: 1, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 1n,
      data: new Uint8Array([41]),
      instanceHandle: undefined,
    };
    history.set(firstEntry);
    missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(1);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(1n);
    expect(history.get(1n)).toBe(firstEntry);
    expect(history.get(2n)).toBeUndefined();
    expect(history.get(3n)).toBeUndefined();
    expect(history.get(4n)).toBeUndefined();
    expect(missing.size).toEqual(16);
    expect(missing.base).toEqual(1n);
    expect(missing.numBits).toEqual(3);
    expect(missing.bitmap).toEqual(new Uint32Array([1610612736, 0, 0, 0, 0, 0, 0, 0]));

    const secondEntry = {
      timestamp: { sec: 2, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 2n,
      data: new Uint8Array([42]),
      instanceHandle: undefined,
    };
    history.set(secondEntry);
    missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(2);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(2n);
    expect(history.get(1n)).toBe(firstEntry);
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBeUndefined();
    expect(history.get(4n)).toBeUndefined();
    expect(missing.size).toEqual(16);
    expect(missing.base).toEqual(1n);
    expect(missing.numBits).toEqual(3);
    expect(missing.bitmap).toEqual(new Uint32Array([536870912, 0, 0, 0, 0, 0, 0, 0]));

    const thirdEntry = {
      timestamp: { sec: 3, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 3n,
      data: new Uint8Array([43]),
      instanceHandle: undefined,
    };
    history.set(thirdEntry);
    missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(3);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(3n);
    expect(history.get(1n)).toBe(firstEntry);
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBe(thirdEntry);
    expect(history.get(4n)).toBeUndefined();
    expect(missing.size).toEqual(12);
    expect(missing.base).toEqual(4n);
    expect(missing.numBits).toEqual(0);
    expect(missing.bitmap).toEqual(new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0]));

    const fourthEntry = {
      timestamp: { sec: 4, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 4n,
      data: new Uint8Array([44]),
      instanceHandle: undefined,
    };
    history.set(fourthEntry);
    missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(4);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(4n);
    expect(history.get(1n)).toBe(firstEntry);
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBe(thirdEntry);
    expect(history.get(4n)).toBe(fourthEntry);
    expect(missing.size).toEqual(12);
    expect(missing.base).toEqual(4n);
    expect(missing.numBits).toEqual(0);
    expect(missing.bitmap).toEqual(new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0]));

    missing = history.heartbeatUpdate(2n, 4n);

    expect(history.size).toEqual(3);
    expect(history.getSequenceNumMin()).toEqual(2n);
    expect(history.getSequenceNumMax()).toEqual(4n);
    expect(history.get(1n)).toBeUndefined();
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBe(thirdEntry);
    expect(history.get(4n)).toBe(fourthEntry);
    expect(missing.size).toEqual(12);
    expect(missing.base).toEqual(5n);
    expect(missing.numBits).toEqual(0);
    expect(missing.bitmap).toEqual(new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0]));
  });

  it("handles adding out of order", () => {
    const history = new ReaderHistoryCache({
      history: { kind: HistoryKind.KeepLast, depth: 3 },
    });

    const secondEntry = {
      timestamp: { sec: 2, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 2n,
      data: new Uint8Array([42]),
      instanceHandle: undefined,
    };
    history.set(secondEntry);
    let missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(1);
    expect(history.getSequenceNumMin()).toEqual(2n);
    expect(history.getSequenceNumMax()).toEqual(2n);
    expect(history.get(1n)).toBeUndefined();
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBeUndefined();
    expect(history.get(4n)).toBeUndefined();
    expect(missing.size).toEqual(16);
    expect(missing.base).toEqual(1n);
    expect(missing.numBits).toEqual(3);
    expect(missing.bitmap).toEqual(new Uint32Array([2684354560, 0, 0, 0, 0, 0, 0, 0]));

    const firstEntry = {
      timestamp: { sec: 1, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 1n,
      data: new Uint8Array([41]),
      instanceHandle: undefined,
    };
    history.set(firstEntry);
    missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(2);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(2n);
    expect(history.get(1n)).toBe(firstEntry);
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBeUndefined();
    expect(history.get(4n)).toBeUndefined();
    expect(missing.size).toEqual(16);
    expect(missing.base).toEqual(1n);
    expect(missing.numBits).toEqual(3);
    expect(missing.bitmap).toEqual(new Uint32Array([536870912, 0, 0, 0, 0, 0, 0, 0]));

    const fourthEntry = {
      timestamp: { sec: 4, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 4n,
      data: new Uint8Array([44]),
      instanceHandle: undefined,
    };
    history.set(fourthEntry);
    missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(3);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(4n);
    expect(history.get(1n)).toBe(firstEntry);
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBeUndefined();
    expect(history.get(4n)).toBe(fourthEntry);
    expect(missing.size).toEqual(16);
    expect(missing.base).toEqual(1n);
    expect(missing.numBits).toEqual(3);
    expect(missing.bitmap).toEqual(new Uint32Array([536870912, 0, 0, 0, 0, 0, 0, 0]));
    expect(firstEntry.kind).toEqual(ChangeKind.Alive);

    const thirdEntry = {
      timestamp: { sec: 3, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 3n,
      data: new Uint8Array([43]),
      instanceHandle: undefined,
    };
    history.set(thirdEntry);
    missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(4);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(4n);
    expect(history.get(1n)).toBe(firstEntry);
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBe(thirdEntry);
    expect(history.get(4n)).toBe(fourthEntry);
    expect(missing.size).toEqual(12);
    expect(missing.base).toEqual(4n);
    expect(missing.numBits).toEqual(0);
    expect(missing.bitmap).toEqual(new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0]));
    expect(firstEntry.kind).toEqual(ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered);
  });

  it("handles gaps", () => {
    const history = new ReaderHistoryCache({
      history: { kind: HistoryKind.KeepLast, depth: 3 },
    });

    const firstGap = {
      timestamp: { sec: 1, nsec: 0 },
      kind: ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered,
      writerGuid,
      sequenceNumber: 1n,
      data: empty,
      instanceHandle: undefined,
    };
    history.set(firstGap);
    let missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(1);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(1n);
    expect(history.get(1n)).toBe(firstGap);
    expect(history.get(2n)).toBeUndefined();
    expect(history.get(3n)).toBeUndefined();
    expect(history.get(4n)).toBeUndefined();
    expect(history.get(5n)).toBeUndefined();
    expect(history.get(6n)).toBeUndefined();
    expect(missing.size).toEqual(16);
    expect(missing.base).toEqual(1n);
    expect(missing.numBits).toEqual(3);
    expect(missing.bitmap).toEqual(new Uint32Array([1610612736, 0, 0, 0, 0, 0, 0, 0]));

    const secondEntry = {
      timestamp: { sec: 2, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 2n,
      data: new Uint8Array([42]),
      instanceHandle: undefined,
    };
    history.set(secondEntry);

    const thirdGap = {
      timestamp: { sec: 3, nsec: 0 },
      kind: ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered,
      writerGuid,
      sequenceNumber: 3n,
      data: empty,
      instanceHandle: undefined,
    };
    const fourthGap = {
      timestamp: { sec: 4, nsec: 0 },
      kind: ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered,
      writerGuid,
      sequenceNumber: 4n,
      data: empty,
      instanceHandle: undefined,
    };
    const sixthGap = {
      timestamp: { sec: 6, nsec: 0 },
      kind: ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered,
      writerGuid,
      sequenceNumber: 6n,
      data: empty,
      instanceHandle: undefined,
    };

    history.set(thirdGap);
    history.set(fourthGap);
    history.set(sixthGap);

    expect(history.size).toEqual(5);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(6n);
    expect(history.get(1n)).toBe(firstGap);
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBe(thirdGap);
    expect(history.get(4n)).toBe(fourthGap);
    expect(history.get(5n)).toBeUndefined();
    expect(history.get(6n)).toBe(sixthGap);
    expect(missing.size).toEqual(16);
    expect(missing.base).toEqual(1n);
    expect(missing.numBits).toEqual(3);
    expect(missing.bitmap).toEqual(new Uint32Array([1610612736, 0, 0, 0, 0, 0, 0, 0]));
    expect(secondEntry.kind).toEqual(ChangeKind.Alive);

    const fifthEntry = {
      timestamp: { sec: 5, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 5n,
      data: new Uint8Array([45]),
      instanceHandle: undefined,
    };
    history.set(fifthEntry);

    missing = history.heartbeatUpdate(1n, 3n);

    expect(history.size).toEqual(6);
    expect(history.getSequenceNumMin()).toEqual(1n);
    expect(history.getSequenceNumMax()).toEqual(6n);
    expect(history.get(1n)).toBe(firstGap);
    expect(history.get(2n)).toBe(secondEntry);
    expect(history.get(3n)).toBe(thirdGap);
    expect(history.get(4n)).toBe(fourthGap);
    expect(history.get(5n)).toBe(fifthEntry);
    expect(history.get(6n)).toBe(sixthGap);
    expect(missing.size).toEqual(12);
    expect(missing.base).toEqual(4n);
    expect(missing.numBits).toEqual(0);
    expect(missing.bitmap).toEqual(new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0]));
    expect(secondEntry.kind).toEqual(ChangeKind.Alive);
    expect(fifthEntry.kind).toEqual(ChangeKind.Alive);

    missing = history.heartbeatUpdate(5n, 10n);
    expect(history.size).toEqual(2);
  });

  it("handles gap ranges", () => {
    const history = new ReaderHistoryCache({
      history: { kind: HistoryKind.KeepLast, depth: 2 },
    });

    history.addGapRange(2n, 5n, { sec: 2, nsec: 0 }, writerGuid);

    expect(history.size).toEqual(4);
    expect(history.getSequenceNumMin()).toEqual(2n);
    expect(history.getSequenceNumMax()).toEqual(5n);

    const sixthEntry = {
      timestamp: { sec: 6, nsec: 0 },
      kind: ChangeKind.Alive,
      writerGuid,
      sequenceNumber: 6n,
      data: new Uint8Array([46]),
      instanceHandle: undefined,
    };
    history.set(sixthEntry);

    expect(history.size).toEqual(5);
    expect(history.getSequenceNumMin()).toEqual(2n);
    expect(history.getSequenceNumMax()).toEqual(6n);
    expect(history.get(6n)).toBe(sixthEntry);

    history.addGapRange(4n, 7n, { sec: 4, nsec: 0 }, writerGuid);

    expect(history.size).toEqual(6);
    expect(history.getSequenceNumMin()).toEqual(2n);
    expect(history.getSequenceNumMax()).toEqual(7n);
    expect(history.get(6n)).toEqual({
      timestamp: { sec: 4, nsec: 0 },
      kind: ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered,
      writerGuid,
      sequenceNumber: 6n,
      data: empty,
      instanceHandle: undefined,
    });
  });
});
