import { DataFragments } from "./DataFragments";

describe("DataFragments", () => {
  it("should work with even fragment sizes", async () => {
    const fragments = new DataFragments(10, 2);
    expect(fragments.totalBytes).toBe(10);
    expect(fragments.fragmentSize).toBe(2);
    expect(fragments.lastFragmentSize).toBe(2);
    expect(fragments.fragmentCount).toBe(5);
    expect(fragments.fragments).toHaveLength(5);
    expect(fragments.remainingFragments).toBe(5);
    expect(Array.from(fragments.missingFragments(0))).toEqual([]);
    expect(Array.from(fragments.missingFragments(5))).toEqual([0, 1, 2, 3, 4]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(0, new Uint8Array([0, 1]))).toBe(false);
    expect(fragments.remainingFragments).toBe(4);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(false);
    expect(Array.from(fragments.missingFragments(5))).toEqual([1, 2, 3, 4]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(1, new Uint8Array([2, 3]))).toBe(false);
    expect(fragments.remainingFragments).toBe(3);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(false);
    expect(Array.from(fragments.missingFragments(5))).toEqual([2, 3, 4]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(2, new Uint8Array([4, 5]))).toBe(false);
    expect(fragments.remainingFragments).toBe(2);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(true);
    expect(fragments.hasUpTo(3)).toBe(false);
    expect(Array.from(fragments.missingFragments(5))).toEqual([3, 4]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(3, new Uint8Array([6, 7]))).toBe(false);
    expect(fragments.remainingFragments).toBe(1);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(true);
    expect(fragments.hasUpTo(3)).toBe(true);
    expect(fragments.hasUpTo(4)).toBe(false);
    expect(Array.from(fragments.missingFragments(5))).toEqual([4]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(4, new Uint8Array([8, 9]))).toBe(true);
    expect(fragments.remainingFragments).toBe(0);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(true);
    expect(fragments.hasUpTo(3)).toBe(true);
    expect(fragments.hasUpTo(4)).toBe(true);
    expect(Array.from(fragments.missingFragments(5))).toEqual([]);
    expect(fragments.data()).toEqual(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  it("should work with a different lastFragmentSize", async () => {
    const fragments = new DataFragments(10, 3);
    expect(fragments.totalBytes).toBe(10);
    expect(fragments.fragmentSize).toBe(3);
    expect(fragments.lastFragmentSize).toBe(1);
    expect(fragments.fragmentCount).toBe(4);
    expect(fragments.fragments).toHaveLength(4);
    expect(fragments.remainingFragments).toBe(4);
    expect(Array.from(fragments.missingFragments(4))).toEqual([0, 1, 2, 3]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(0, new Uint8Array([0, 1, 2]))).toBe(false);
    expect(fragments.remainingFragments).toBe(3);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(false);
    expect(Array.from(fragments.missingFragments(4))).toEqual([1, 2, 3]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(1, new Uint8Array([3, 4, 5]))).toBe(false);
    expect(fragments.remainingFragments).toBe(2);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(false);
    expect(Array.from(fragments.missingFragments(4))).toEqual([2, 3]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(2, new Uint8Array([6, 7, 8]))).toBe(false);
    expect(fragments.remainingFragments).toBe(1);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(true);
    expect(fragments.hasUpTo(3)).toBe(false);
    expect(Array.from(fragments.missingFragments(4))).toEqual([3]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(3, new Uint8Array([9]))).toBe(true);
    expect(fragments.remainingFragments).toBe(0);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(true);
    expect(fragments.hasUpTo(3)).toBe(true);
    expect(Array.from(fragments.missingFragments(4))).toEqual([]);
    expect(fragments.data()).toEqual(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  it("should work with out of order fragments", async () => {
    const fragments = new DataFragments(10, 3);
    expect(Array.from(fragments.missingFragments(4))).toEqual([0, 1, 2, 3]);

    expect(fragments.addFragment(1, new Uint8Array([3, 4, 5]))).toBe(false);
    expect(fragments.remainingFragments).toBe(3);
    expect(fragments.hasUpTo(0)).toBe(false);
    expect(fragments.hasUpTo(1)).toBe(false);
    expect(fragments.hasUpTo(2)).toBe(false);
    expect(fragments.hasUpTo(3)).toBe(false);
    expect(Array.from(fragments.missingFragments(4))).toEqual([0, 2, 3]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(3, new Uint8Array([9]))).toBe(false);
    expect(fragments.remainingFragments).toBe(2);
    expect(fragments.hasUpTo(0)).toBe(false);
    expect(fragments.hasUpTo(1)).toBe(false);
    expect(fragments.hasUpTo(2)).toBe(false);
    expect(fragments.hasUpTo(3)).toBe(false);
    expect(Array.from(fragments.missingFragments(4))).toEqual([0, 2]);

    expect(fragments.addFragment(0, new Uint8Array([0, 1, 2]))).toBe(false);
    expect(fragments.remainingFragments).toBe(1);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(false);
    expect(fragments.hasUpTo(3)).toBe(false);
    expect(Array.from(fragments.missingFragments(4))).toEqual([2]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(0, new Uint8Array([0, 1, 2]))).toBe(false);
    expect(fragments.remainingFragments).toBe(1);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(false);
    expect(fragments.hasUpTo(3)).toBe(false);
    expect(Array.from(fragments.missingFragments(4))).toEqual([2]);
    expect(fragments.data()).toBeUndefined();

    expect(fragments.addFragment(2, new Uint8Array([6, 7, 8]))).toBe(true);
    expect(fragments.remainingFragments).toBe(0);
    expect(fragments.hasUpTo(0)).toBe(true);
    expect(fragments.hasUpTo(1)).toBe(true);
    expect(fragments.hasUpTo(2)).toBe(true);
    expect(fragments.hasUpTo(3)).toBe(true);
    expect(Array.from(fragments.missingFragments(4))).toEqual([]);
    expect(fragments.data()).toEqual(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });
});
