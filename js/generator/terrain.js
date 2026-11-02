/**
 * Rolling Plains Terrain Generator
 * --------------------------------
 * Computes multi-octave rolling hills terrain:
 * - 3 Octaves: Low freq (broad hills), Mid freq (contours), High freq (micro surface)
 * - Strict clamping between Y=62 and Y=72
 * - Safe spawn point calculator on surface grass at Chunk (0,0)
 */

(function (root) {
  'use strict';

  class RollingPlainsTerrain {
    constructor(seed) {
      const s = typeof seed === 'bigint' ? seed : BigInt(seed);
      const NoiseClass = root.PerlinNoise2D || (typeof require !== 'undefined' ? require('./noise.js').PerlinNoise2D : null);
      if (!NoiseClass) {
        throw new Error('PerlinNoise2D class not found. Ensure noise.js is loaded first.');
      }
      this.noise1 = new NoiseClass(s);
      this.noise2 = new NoiseClass(s + 101n);
      this.noise3 = new NoiseClass(s + 202n);
    }

    getHeight(x, z) {
      // 3 Octaves: Low freq (broad hills), Mid freq (contours), High freq (micro surface)
      const n1 = this.noise1.sample(x * 0.03, z * 0.03) * 4.5;
      const n2 = this.noise2.sample(x * 0.08, z * 0.08) * 2.0;
      const n3 = this.noise3.sample(x * 0.18, z * 0.18) * 0.8;
      const total = n1 + n2 + n3;
      const h = Math.round(66.0 + total);
      // Clamp strictly between Y=62 and Y=72
      return Math.max(62, Math.min(72, h));
    }
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RollingPlainsTerrain };
  } else {
    root.RollingPlainsTerrain = RollingPlainsTerrain;
  }
})(typeof window !== 'undefined' ? window : globalThis);
