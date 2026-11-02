/**
 * Java LCG Random & Multi-Octave Perlin Noise Generator
 * -----------------------------------------------------
 * Faithful implementation of Minecraft Java Edition's random & noise:
 * - JavaRandom: 48-bit Linear Congruential Generator (LCG)
 * - PerlinNoise2D: Gradient 2D noise with Ken Perlin's fade and permutation table
 */

(function (root) {
  'use strict';

  class JavaRandom {
    constructor(seed) {
      this.setSeed(seed);
    }

    setSeed(seed) {
      const big = typeof seed === 'bigint' ? seed : BigInt(seed);
      this.seed = (big ^ 0x5DEECE66Dn) & 0xFFFFFFFFFFFFn;
    }

    next(bits) {
      this.seed = (this.seed * 0x5DEECE66Dn + 0xBn) & 0xFFFFFFFFFFFFn;
      return Number(this.seed >> (48n - BigInt(bits)));
    }

    nextInt(bound) {
      if (bound <= 0) return 0;
      return Math.floor(Math.abs(this.next(31)) % bound);
    }
  }

  class PerlinNoise2D {
    constructor(seed) {
      const rnd = new JavaRandom(seed);
      const p = new Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      // Fisher-Yates shuffle
      for (let i = 255; i > 0; i--) {
        const j = rnd.nextInt(i + 1);
        const tmp = p[i];
        p[i] = p[j];
        p[j] = tmp;
      }
      this.perm = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        this.perm[i] = p[i & 255];
      }
    }

    static fade(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    static lerp(t, a, b) {
      return a + t * (b - a);
    }

    static grad(hashVal, x, z) {
      const h = hashVal & 7;
      const u = h < 4 ? x : z;
      const v = h < 4 ? z : x;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    sample(x, z) {
      const X = Math.floor(x) & 255;
      const Z = Math.floor(z) & 255;
      const xf = x - Math.floor(x);
      const zf = z - Math.floor(z);
      const u = PerlinNoise2D.fade(xf);
      const v = PerlinNoise2D.fade(zf);

      const aa = this.perm[this.perm[X] + Z];
      const ab = this.perm[this.perm[X] + Z + 1];
      const ba = this.perm[this.perm[X + 1] + Z];
      const bb = this.perm[this.perm[X + 1] + Z + 1];

      const x1 = PerlinNoise2D.lerp(u, PerlinNoise2D.grad(aa, xf, zf), PerlinNoise2D.grad(ba, xf - 1, zf));
      const x2 = PerlinNoise2D.lerp(u, PerlinNoise2D.grad(ab, xf, zf - 1), PerlinNoise2D.grad(bb, xf - 1, zf - 1));
      return PerlinNoise2D.lerp(v, x1, x2);
    }
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JavaRandom, PerlinNoise2D };
  } else {
    root.JavaRandom = JavaRandom;
    root.PerlinNoise2D = PerlinNoise2D;
  }
})(typeof window !== 'undefined' ? window : globalThis);
