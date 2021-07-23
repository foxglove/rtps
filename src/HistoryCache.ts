import { CacheChange } from "./CacheChange";
import { SequenceNumberSet } from "./SequenceNumberSet";

export class HistoryCache {
  // TODO: remove() could be sped up by using a sorted data structure
  private map_ = new Map<bigint, CacheChange>();
  private min_?: bigint;
  private max_?: bigint;

  add(sequenceNum: bigint, change: CacheChange): void {
    this.map_.set(sequenceNum, change);
    if (this.min_ == undefined || sequenceNum < this.min_) {
      this.min_ = sequenceNum;
    }
    if (this.max_ == undefined || sequenceNum > this.max_) {
      this.max_ = sequenceNum;
    }
  }

  remove(sequenceNum: bigint): boolean {
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

  get(sequenceNum: bigint): CacheChange | undefined {
    return this.map_.get(sequenceNum);
  }

  getSequenceNumMin(): bigint | undefined {
    return this.min_;
  }

  getSequenceNumMax(): bigint | undefined {
    return this.max_;
  }

  getMissingSequenceNums(firstSeqNumber: bigint, lastSeqNumber: bigint): SequenceNumberSet {
    if (lastSeqNumber < firstSeqNumber) {
      throw new Error(`Invalid sequence number range [${firstSeqNumber}, ${lastSeqNumber}]`);
    }
    const numBits = Math.min(Number(lastSeqNumber - firstSeqNumber), 256);
    const set = new SequenceNumberSet(firstSeqNumber, numBits);
    for (let seq = firstSeqNumber; seq < lastSeqNumber; seq++) {
      if (!this.map_.has(seq)) {
        set.add(seq);
      }
    }
    return set;
  }

  private _findMin(): bigint | undefined {
    let min: bigint | undefined;
    for (const seq of this.map_.keys()) {
      if (min == undefined || seq < min) {
        min = seq;
      }
    }
    return min;
  }

  private _findMax(): bigint | undefined {
    let max: bigint | undefined;
    for (const seq of this.map_.keys()) {
      if (max == undefined || seq > max) {
        max = seq;
      }
    }
    return max;
  }
}
