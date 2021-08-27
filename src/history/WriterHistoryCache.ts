import AVLTree from "avl";

import { ChangeKind, Guid, HistoryAndDepth, HistoryKind, SequenceNumber } from "../common";
import { CacheChange, EMPTY_DATA } from "./CacheChange";

const comparator = (a: SequenceNumber, b: SequenceNumber) => Number(a - b);

export class WriterHistoryCache {
  readonly depth: number;

  private _handleToEntries = new Map<Guid, AVLTree<SequenceNumber, CacheChange>>();
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
    if (isGap(change)) {
      throw new Error(`cannot write GAPs to WriterHistoryCache`);
    }

    // Update _handleToEntries
    const handle = change.instanceHandle ?? "";
    let changes = this._handleToEntries.get(handle);
    if (changes == undefined) {
      changes = new AVLTree(comparator);
      this._handleToEntries.set(handle, changes);
    }
    changes.insert(change.sequenceNumber, change);

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

    // Update _sequenceToEntry
    this._sequenceToEntry.insert(change.sequenceNumber, change);

    this.trim();
  }

  get(sequenceNumber: SequenceNumber): CacheChange | undefined {
    return this._sequenceToEntry.find(sequenceNumber)?.data;
  }

  getByHandle(handle: Guid): CacheChange | undefined {
    return this._handleToEntries.get(handle)?.maxNode()?.data;
  }

  getSequenceNumMin(): SequenceNumber | undefined {
    return this._sequenceToEntry.minNode()?.key;
  }

  getSequenceNumMax(): SequenceNumber | undefined {
    return this._sequenceToEntry.maxNode()?.key;
  }

  getSequenceNumMinPossible(): SequenceNumber {
    const minPossible = (this.getSequenceNumMax() ?? 0n) - BigInt(this.depth) + 1n;
    return minPossible >= 0n ? minPossible : 0n;
  }

  nextSequenceNum(): SequenceNumber {
    return (this.getSequenceNumMax() ?? 0n) + 1n;
  }

  private trim(): void {
    // Trim disposed entries from the beginning of _sequenceToEntry
    let front = this._sequenceToEntry.minNode()?.data;
    while (front != undefined && isGap(front)) {
      this._sequenceToEntry.pop();
      front = this._sequenceToEntry.minNode()?.data;
    }
  }
}

function isGap(change: CacheChange): boolean {
  return change.kind !== ChangeKind.Alive && change.data.length === 0;
}
