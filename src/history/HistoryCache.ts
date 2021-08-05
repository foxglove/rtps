import { SequenceNumber, SequenceNumberSet } from "../common";
import { CacheChange } from "./CacheChange";

export class HistoryCache {
  // TODO: remove() could be sped up by using a sorted data structure
  private map_ = new Map<SequenceNumber, CacheChange>();
  private min_?: SequenceNumber;
  private max_?: SequenceNumber;

  get size(): number {
    return this.map_.size;
  }

  add(sequenceNum: SequenceNumber, change: CacheChange): void {
    this.map_.set(sequenceNum, change);
    if (this.min_ == undefined || sequenceNum < this.min_) {
      this.min_ = sequenceNum;
    }
    if (this.max_ == undefined || sequenceNum > this.max_) {
      this.max_ = sequenceNum;
    }
  }

  remove(sequenceNum: SequenceNumber): boolean {
    if (this.map_.delete(sequenceNum)) {
      if (sequenceNum === this.min_) {
        this.min_ = this._findMin();
      }
      if (sequenceNum === this.max_) {
        this.max_ = this._findMax();
      }
      return true;
    }
    return false;
  }

  get(sequenceNum: SequenceNumber): CacheChange | undefined {
    return this.map_.get(sequenceNum);
  }

  getSequenceNumMin(): SequenceNumber | undefined {
    return this.min_;
  }

  getSequenceNumMax(): SequenceNumber | undefined {
    return this.max_;
  }

  getMissingSequenceNums(
    firstSeqNumber: SequenceNumber,
    lastSeqNumber: SequenceNumber,
  ): SequenceNumberSet {
    if (lastSeqNumber < firstSeqNumber) {
      // eslint-disable-next-line no-param-reassign
      firstSeqNumber = lastSeqNumber;
    }
    // FIXME: This is not correct. base should be set to the first missing sequence number, or
    // lastSeqNumber + 1. numBits is only non-zero if there are misses
    const numBits = Math.min(1 + Number(lastSeqNumber - firstSeqNumber), 256);
    const set = new SequenceNumberSet(firstSeqNumber, numBits);
    let hasAll = true;
    for (let seq = firstSeqNumber; seq <= lastSeqNumber; seq++) {
      if (!this.map_.has(seq)) {
        set.add(seq);
        hasAll = false;
      }
    }
    return hasAll ? new SequenceNumberSet(lastSeqNumber + 1n, 0) : set;
  }

  private _findMin(): SequenceNumber | undefined {
    let min: SequenceNumber | undefined;
    for (const seq of this.map_.keys()) {
      if (min == undefined || seq < min) {
        min = seq;
      }
    }
    return min;
  }

  private _findMax(): SequenceNumber | undefined {
    let max: SequenceNumber | undefined;
    for (const seq of this.map_.keys()) {
      if (max == undefined || seq > max) {
        max = seq;
      }
    }
    return max;
  }
}
