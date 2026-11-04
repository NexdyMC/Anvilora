/**
 * Cubiomes Noise & Java PRNG Module (Pure JavaScript Port)
 * --------------------------------------------------------
 * Direct port of cubiomes/noise.h, cubiomes/noise.c, and cubiomes/rng.h
 * Target: Minecraft Java Edition 1.16.1
 */

(function (root) {
  'use strict';

  // 1. 64-Bit Java PRNG LCG Functions for Minecraft World Generation
  const M_6364 = 6364136223846793005n;
  const A_1442 = 1442695040888963407n;

  function mcStepSeed(s, salt) {
    const sBig = typeof s === 'bigint' ? s : BigInt(s);
    const saltBig = typeof salt === 'bigint' ? salt : BigInt(salt);
    const inner = BigInt.asUintN(64, sBig * M_6364 + A_1442);
    return BigInt.asUintN(64, sBig * inner + saltBig);
  }

  function mcFirstInt(s, mod) {
    const sBig = typeof s === 'bigint' ? s : BigInt(s);
    const signedVal = BigInt.asIntN(64, sBig);
    let ret = Number((signedVal >> 24n) % BigInt(mod));
    if (ret < 0) ret += mod;
    return ret;
  }

  function mcFirstIsZero(s, mod) {
    const sBig = typeof s === 'bigint' ? s : BigInt(s);
    const signedVal = BigInt.asIntN(64, sBig);
    return Number((signedVal >> 24n) % BigInt(mod)) === 0;
  }

  function getChunkSeed(ss, x, z) {
    const ssBig = typeof ss === 'bigint' ? ss : BigInt(ss);
    const xBig = BigInt(x);
    const zBig = BigInt(z);
    let cs = BigInt.asUintN(64, ssBig + xBig);
    cs = mcStepSeed(cs, zBig);
    cs = mcStepSeed(cs, xBig);
    cs = mcStepSeed(cs, zBig);
    return cs;
  }

  function getLayerSalt(salt) {
    const saltBig = typeof salt === 'bigint' ? salt : BigInt(salt);
    let ls = mcStepSeed(saltBig, saltBig);
    ls = mcStepSeed(ls, saltBig);
    ls = mcStepSeed(ls, saltBig);
    return ls;
  }

  function getStartSalt(ws, ls) {
    let st = typeof ws === 'bigint' ? ws : BigInt(ws);
    const lsBig = typeof ls === 'bigint' ? ls : BigInt(ls);
    st = mcStepSeed(st, lsBig);
    st = mcStepSeed(st, lsBig);
    st = mcStepSeed(st, lsBig);
    return st;
  }

  function getStartSeed(ws, ls) {
    let ss = getStartSalt(ws, ls);
    return mcStepSeed(ss, 0n);
  }

  // 2. Classical Java Random for Perlin initialization
  class JavaRandom {
    constructor(seed = 0n) {
      this.seed = 0n;
      this.setSeed(seed);
    }

    setSeed(seed) {
      const s = typeof seed === 'bigint' ? seed : BigInt(seed);
      this.seed = (s ^ 0x5DEECE66Dn) & ((1n << 48n) - 1n);
    }

    next(bits) {
      this.seed = (this.seed * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n);
      return Number(this.seed >> (48n - BigInt(bits)));
    }

    nextInt(bound) {
      if (bound <= 0) return 0;
      if ((bound & -bound) === bound) {
        return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
      }
      let bits, val;
      do {
        bits = this.next(31);
        val = bits % bound;
      } while (bits - val + (bound - 1) < 0);
      return val;
    }

    nextDouble() {
      const high = BigInt(this.next(26));
      const low = BigInt(this.next(27));
      return Number((high << 27n) + low) / 9007199254740992.0;
    }
  }

  // 3. Minecraft Perlin Noise Implementation (for Ocean Temperatures)
  class PerlinNoise {
    constructor(seed) {
      this.d = new Uint8Array(257);
      this.a = 0;
      this.b = 0;
      this.c = 0;
      this.d2 = 0;
      this.h2 = 0;
      this.t2 = 0;
      this.init(seed);
    }

    init(seed) {
      const rnd = new JavaRandom(seed);
      this.a = rnd.nextDouble() * 256.0;
      this.b = rnd.nextDouble() * 256.0;
      this.c = rnd.nextDouble() * 256.0;

      for (let i = 0; i < 256; i++) {
        this.d[i] = i;
      }
      for (let i = 0; i < 256; i++) {
        const j = rnd.nextInt(256 - i) + i;
        const temp = this.d[i];
        this.d[i] = this.d[j];
        this.d[j] = temp;
      }
      this.d[256] = this.d[0];

      const i2 = Math.floor(this.b);
      this.d2 = this.b - i2;
      this.h2 = i2 & 0xFF;
      this.t2 = this.d2 * this.d2 * this.d2 * (this.d2 * (this.d2 * 6.0 - 15.0) + 10.0);
    }

    sample(x, y, z) {
      const d1 = x + this.a;
      let d2 = y + this.b;
      const d3 = z + this.c;

      const i1 = Math.floor(d1);
      const i3 = Math.floor(d3);

      const f1 = d1 - i1;
      const f3 = d3 - i3;

      const h1 = i1 & 0xFF;
      const h3 = i3 & 0xFF;

      const t1 = f1 * f1 * f1 * (f1 * (f1 * 6.0 - 15.0) + 10.0);
      const t3 = f3 * f3 * f3 * (f3 * (f3 * 6.0 - 15.0) + 10.0);

      const d2Val = this.d2;
      const h2Val = this.h2;
      const t2Val = this.t2;

      const a = this.d[h1] + h2Val;
      const aa = this.d[a & 0xFF] + h3;
      const ab = this.d[(a + 1) & 0xFF] + h3;
      const b = this.d[(h1 + 1) & 0xFF] + h2Val;
      const ba = this.d[b & 0xFF] + h3;
      const bb = this.d[(b + 1) & 0xFF] + h3;

      const l1 = lerp(t1, grad(this.d[aa & 0xFF], f1, d2Val, f3), grad(this.d[ba & 0xFF], f1 - 1.0, d2Val, f3));
      const l2 = lerp(t1, grad(this.d[ab & 0xFF], f1, d2Val - 1.0, f3), grad(this.d[bb & 0xFF], f1 - 1.0, d2Val - 1.0, f3));
      const l3 = lerp(t1, grad(this.d[(aa + 1) & 0xFF], f1, d2Val, f3 - 1.0), grad(this.d[(ba + 1) & 0xFF], f1 - 1.0, d2Val, f3 - 1.0));
      const l4 = lerp(t1, grad(this.d[(ab + 1) & 0xFF], f1, d2Val - 1.0, f3 - 1.0), grad(this.d[(bb + 1) & 0xFF], f1 - 1.0, d2Val - 1.0, f3 - 1.0));

      const res1 = lerp(t2Val, l1, l2);
      const res2 = lerp(t2Val, l3, l4);
      return lerp(t3, res1, res2);
    }
  }

  function lerp(t, a, b) {
    return a + t * (b - a);
  }

  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  // Export
  const CubiomesNoise = {
    mcStepSeed,
    mcFirstInt,
    mcFirstIsZero,
    getChunkSeed,
    getLayerSalt,
    getStartSalt,
    getStartSeed,
    JavaRandom,
    PerlinNoise
  };

  root.CubiomesNoise = CubiomesNoise;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CubiomesNoise;
  }
})(typeof window !== 'undefined' ? window : globalThis);
