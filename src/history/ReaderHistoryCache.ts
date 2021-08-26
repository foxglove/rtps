import { Time } from "@foxglove/rostime";
import { default as AVLTree } from "avl";

import {
  ChangeKind,
  Guid,
  HistoryAndDepth,
  HistoryKind,
  SequenceNumber,
  SequenceNumberSet,
} from "../common";
import { CacheChange, EMPTY_DATA } from "./CacheChange";

const comparator = (a: SequenceNumber, b: SequenceNumber) => Number(a - b);

export class ReaderHistoryCache {
  readonly depth: number;

  private _handleToEntries = new Map<string, AVLTree<SequenceNumber, CacheChange>>();
  private _sequenceToEntry = new AVLTree<SequenceNumber, CacheChange>(comparator);

  constructor(opts: { history: HistoryAndDepth }) {
    this.depth =
      opts.history.kind === HistoryKind.KeepAll || opts.history.depth < 0
        ? Number.MAX_SAFE_INTEGER
        : opts.history.depth;
  }

  get size(): number {
    return this._sequenceToEntry.size;
  }

  set(change: CacheChange): void {
    if (change.kind === ChangeKind.Alive) {
      // Update _handleToEntries
      const handle = change.instanceHandle ?? "";
      let changes = this._handleToEntries.get(handle);
      if (changes == undefined) {
        changes = new AVLTree(comparator);
        this._handleToEntries.set(handle, changes);
      }
      setTreeEntry(changes, change);

      // Prune excess entries for this instanceHandle
      while (changes.size > this.depth) {
        const removedChange = changes.pop()?.data;
        if (removedChange != undefined) {
          // This CacheChange still exists in _sequenceToEntry, so mark it as disposed
          removedChange.kind = ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered;
          removedChange.data = EMPTY_DATA;
          removedChange.instanceHandle = undefined;
        }
      }

      if (changes.size === 0) {
        this._handleToEntries.delete(handle);
      }
    }

    // Update _sequenceToEntry
    setTreeEntry(this._sequenceToEntry, change);
  }

  addGapRange(start: SequenceNumber, end: SequenceNumber, timestamp: Time, writerGuid: Guid): void {
    for (let sequenceNumber = start; sequenceNumber <= end; sequenceNumber++) {
      this.set({
        timestamp,
        kind: ChangeKind.NotAliveDisposed | ChangeKind.NotAliveUnregistered,
        writerGuid,
        sequenceNumber,
        data: EMPTY_DATA,
        instanceHandle: undefined,
      });
    }
  }

  get(sequenceNumber: SequenceNumber): CacheChange | undefined {
    return this._sequenceToEntry.find(sequenceNumber)?.data;
  }

  getSequenceNumMin(): SequenceNumber | undefined {
    return this._sequenceToEntry.minNode()?.key;
  }

  getSequenceNumMax(): SequenceNumber | undefined {
    return this._sequenceToEntry.maxNode()?.key;
  }

  heartbeatUpdate(
    firstSeqNumber: SequenceNumber,
    lastSeqNumber: SequenceNumber,
  ): SequenceNumberSet {
    if (lastSeqNumber < firstSeqNumber) {
      // No messages available, return an empty set
      return new SequenceNumberSet(lastSeqNumber, 0);
    }

    const numBits = Math.min(1 + Number(lastSeqNumber - firstSeqNumber), 256);
    const set = new SequenceNumberSet(firstSeqNumber, numBits);
    let hasAll = true;
    for (let seq = firstSeqNumber; seq <= lastSeqNumber; seq++) {
      if (!this._sequenceToEntry.contains(seq)) {
        set.add(seq);
        hasAll = false;
      }
    }

    // Discard everything before firstSeqNumber
    let minSeq = this._sequenceToEntry.minNode()?.key;
    while (minSeq != undefined && minSeq < firstSeqNumber) {
      const removedChange = this._sequenceToEntry.pop()?.data;
      if (removedChange != undefined) {
        const handle = removedChange.instanceHandle ?? "";
        const changes = this._handleToEntries.get(handle);
        if (changes != undefined) {
          changes.remove(removedChange.sequenceNumber);
          if (changes.size === 0) {
            this._handleToEntries.delete(handle);
          }
        }
      }
      minSeq = this._sequenceToEntry.minNode()?.key;
    }

    return hasAll ? new SequenceNumberSet(lastSeqNumber + 1n, 0) : set;
  }
}

function setTreeEntry(tree: AVLTree<SequenceNumber, CacheChange>, change: CacheChange) {
  const entry = tree.find(change.sequenceNumber) ?? tree.insert(change.sequenceNumber, change);
  entry.data = change;
}
