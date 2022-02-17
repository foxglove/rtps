/**
 * Convert the fraction portion of an RTPS Timestamp
 * ({ int32 seconds; uint32 fraction }) to nanoseconds, where the fraction is
 * defined as `seconds / 2^32`.
 * @param sec Fractional seconds integer
 * @returns Nanoseconds integer
 */
export function fractionToNanoseconds(fraction: number): number {
  return Math.trunc(Number((BigInt(fraction) * 1_000_000_000n) / 4_294_967_296n));
}

/**
 * Convert nanoseconds to the fraction portion of an RTPS Timestamp
 * ({ int32 seconds; uint32 fraction }) where the fraction is defined as
 * `seconds / 2^32`.
 * @param nsec Nanoseconds integer
 * @returns Fractional seconds integer
 */
export function nanosecondsToFraction(nsec: number): number {
  return Math.trunc(Number((BigInt(nsec) * 4_294_967_296n) / 1_000_000_000n));
}
