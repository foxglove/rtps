export class DataFragments {
  readonly totalBytes: number;
  readonly fragmentSize: number;
  readonly lastFragmentSize: number;
  readonly fragmentCount: number;
  readonly fragments: Uint8Array[];
  count = 0;

  private _remainingFragments: number;

  constructor(totalBytes: number, fragmentSize: number) {
    this.totalBytes = totalBytes;
    this.fragmentSize = fragmentSize;
    this.lastFragmentSize =
      totalBytes % fragmentSize === 0 ? fragmentSize : totalBytes % fragmentSize;
    this.fragmentCount = Math.ceil(totalBytes / fragmentSize);
    this.fragments = new Array<Uint8Array>(this.fragmentCount);
    this._remainingFragments = this.fragmentCount;
  }

  get remainingFragments(): number {
    return this._remainingFragments;
  }

  addFragment(index: number, data: Uint8Array): boolean {
    if (index < 0 || index >= this.fragmentCount) {
      return false;
    }

    const expectedSize =
      index === this.fragmentCount - 1 ? this.lastFragmentSize : this.fragmentSize;
    if (data.byteLength !== expectedSize) {
      throw new Error(
        `Invalid fragment size, expected ${expectedSize} byte but got ${data.byteLength}`,
      );
    }

    const added = this.fragments[index] == undefined;
    this.fragments[index] = data;
    if (added) {
      this._remainingFragments--;
    }
    return this._remainingFragments === 0;
  }

  hasUpTo(index: number): boolean {
    if (index < 0 || index >= this.fragmentCount) {
      return false;
    }

    for (let i = 0; i <= index; i++) {
      if (this.fragments[i] == undefined) {
        return false;
      }
    }
    return true;
  }

  /** Note: returns fragment numbers (index + 1), not indices */
  *missingFragments(lastFragmentNumber: number): Generator<number> {
    const limit = Math.min(this.fragmentCount, lastFragmentNumber);
    for (let i = 0; i < limit; i++) {
      if (this.fragments[i] == undefined) {
        yield i + 1;
      }
    }
  }

  data(): Uint8Array | undefined {
    if (this._remainingFragments > 0) {
      return undefined;
    }

    const output = new Uint8Array(this.totalBytes);
    for (let i = 0; i < this.fragmentCount; i++) {
      const fragment = this.fragments[i]!;
      output.set(fragment, i * this.fragmentSize);
    }
    return output;
  }
}
