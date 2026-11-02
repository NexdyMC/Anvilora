/**
 * Minecraft Seed Parsing (Java 64-bit Equivalent)
 * ------------------------------------------------
 * Converts string or numeric seed inputs into signed 64-bit BigInts:
 * 1. Blank/empty: generates a random signed 64-bit BigInt.
 * 2. Numeric string: parses directly to 64-bit BigInt (clamped).
 * 3. Non-numeric text: computes Java String.hashCode() (32-bit signed int -> BigInt).
 */

(function (root) {
  'use strict';

  function parseMinecraftSeed(input) {
    const trimmed = (input || '').trim();

    // 1. If blank: generate a random signed 64-bit BigInt
    if (!trimmed) {
      const high = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
      const low = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
      let seed = (high << 32n) | low;
      // Convert to signed 64-bit
      if (seed > 0x7FFFFFFFFFFFFFFFn) {
        seed -= 0x10000000000000000n;
      }
      return seed;
    }

    // 2. If it's a numeric integer string, parse directly to 64-bit BigInt
    if (/^-?\d+$/.test(trimmed)) {
      try {
        let val = BigInt(trimmed);
        // Clamp to 64-bit signed integer range
        val = BigInt.asIntN(64, val);
        return val;
      } catch (e) {
        // Fallback to string hash if BigInt parsing fails
      }
    }

    // 3. If it's a string, use Java's standard String.hashCode() algorithm
    let hash = 0;
    for (let i = 0; i < trimmed.length; i++) {
      const charCode = trimmed.charCodeAt(i);
      hash = ((hash << 5) - hash) + charCode;
      hash |= 0; // Convert to 32-bit signed integer
    }
    return BigInt(hash);
  }

  // Export to global scope (browser window or NodeJS module)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseMinecraftSeed };
  } else {
    root.parseMinecraftSeed = parseMinecraftSeed;
  }
})(typeof window !== 'undefined' ? window : globalThis);
