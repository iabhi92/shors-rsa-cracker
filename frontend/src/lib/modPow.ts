/** m = base^exponent mod modulus, computed with BigInt so intermediate squarings never overflow
 * Number's 2^53 safe-integer limit even though the inputs themselves are plain numbers. Shared
 * across every visual that needs to show a real intermediate RSA value client-side (the backend
 * only ever returns final results, not every intermediate block/blinding-factor computation). */
export function modPow(base: number, exponent: number, modulus: number): number {
  let b = BigInt(base) % BigInt(modulus)
  let e = BigInt(exponent)
  const m = BigInt(modulus)
  let result = 1n
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m
    b = (b * b) % m
    e >>= 1n
  }
  return Number(result)
}
