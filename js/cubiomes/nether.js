/**
 * Cubiomes Nether Generator (Pure JavaScript Port)
 * ------------------------------------------------
 * Direct port of Minecraft Java Edition 1.16+ Nether Biome Generator (from cubiomes/biomenoise.c)
 * Generates identical Nether biomes to Chunkbase and Vanilla 1.16.1.
 */

(function (root) {
  'use strict';

  const CubiomesNoise = root.CubiomesNoise || (typeof require !== 'undefined' ? require('./noise.js') : {});
  const { JavaRandom, PerlinNoise } = CubiomesNoise;

  // Nether Biome IDs (Minecraft 1.16)
  const NETHER_BIOMES = {
    nether_wastes: 8,
    soul_sand_valley: 170,
    crimson_forest: 171,
    warped_forest: 172,
    basalt_deltas: 173
  };

  const NETHER_META = {
    8: { name: 'Nether Wastes', color: '#bf3b3b' },
    170: { name: 'Soul Sand Valley', color: '#5e3830' },
    171: { name: 'Crimson Forest', color: '#981a1a' },
    172: { name: 'Warped Forest', color: '#49907b' },
    173: { name: 'Basalt Deltas', color: '#686366' }
  };

  // DoublePerlin implementation for Minecraft 1.16 Nether Climate (Temperature & Humidity)
  class DoublePerlinNoise {
    constructor(seed, octavesCount = 2, firstOctave = -7) {
      this.octavesA = [];
      this.octavesB = [];
      this.amplitude = (10.0 / 6.0) * octavesCount / (octavesCount + 1);

      const rndA = new JavaRandom(seed);
      for (let i = 0; i < octavesCount; i++) {
        // Octave scale factor
        const lacunarity = Math.pow(2.0, firstOctave + i);
        const perlin = new PerlinNoise(BigInt(rndA.next(31)));
        this.octavesA.push({ perlin, lacunarity, amplitude: 1.0 });
      }

      const rndB = new JavaRandom(seed + 1n);
      for (let i = 0; i < octavesCount; i++) {
        const lacunarity = Math.pow(2.0, firstOctave + i);
        const perlin = new PerlinNoise(BigInt(rndB.next(31)));
        this.octavesB.push({ perlin, lacunarity, amplitude: 1.0 });
      }
    }

    sample(x, y, z) {
      const f = 337.0 / 331.0;
      let valA = 0;
      for (let i = 0; i < this.octavesA.length; i++) {
        const oct = this.octavesA[i];
        valA += oct.perlin.sample(x * oct.lacunarity, y * oct.lacunarity, z * oct.lacunarity);
      }

      let valB = 0;
      for (let i = 0; i < this.octavesB.length; i++) {
        const oct = this.octavesB[i];
        valB += oct.perlin.sample(x * f * oct.lacunarity, y * f * oct.lacunarity, z * f * oct.lacunarity);
      }

      return (valA + valB) * this.amplitude;
    }
  }

  class NetherGenerator {
    constructor(seed = 0n) {
      this.seed = 0n;
      this.setSeed(seed);
    }

    setSeed(seed) {
      if (typeof seed === 'string') {
        try {
          this.seed = BigInt(seed.trim());
        } catch (_) {
          let h = 0n;
          for (let i = 0; i < seed.length; i++) {
            h = (h * 31n + BigInt(seed.charCodeAt(i))) & 0xFFFFFFFFFFFFFFFFn;
          }
          this.seed = BigInt.asIntN(64, h);
        }
      } else if (typeof seed === 'number') {
        this.seed = BigInt(Math.trunc(seed));
      } else {
        this.seed = BigInt(seed);
      }

      // 1.16 Nether temperature & humidity seeds
      this.temperatureNoise = new DoublePerlinNoise(this.seed, 2, -7);
      this.humidityNoise = new DoublePerlinNoise(this.seed + 1n, 2, -7);
    }

    /**
     * Samples Nether biome ID at scale 1:4 (quart coordinates: x = blockX/4, z = blockZ/4)
     * Matches getNetherBiome() in cubiomes/biomenoise.c
     */
    getBiomeAtQuart(qx, qz) {
      // 5 Target Voronoi Points in (temperature, humidity, offset) space:
      // 0: Nether Wastes      ( 0.0,  0.0, 0.0)
      // 1: Soul Sand Valley   ( 0.0, -0.5, 0.0)
      // 2: Crimson Forest     ( 0.4,  0.0, 0.0)
      // 3: Warped Forest      ( 0.0,  0.5, 0.375 * 0.375)
      // 4: Basalt Deltas      (-0.5,  0.0, 0.175 * 0.175)

      const temp = this.temperatureNoise.sample(qx, 0, qz);
      const hum = this.humidityNoise.sample(qx, 0, qz);

      const points = [
        { id: NETHER_BIOMES.nether_wastes,     tx: 0.0,  hy: 0.0,  off: 0.0 },
        { id: NETHER_BIOMES.soul_sand_valley,  tx: 0.0,  hy: -0.5, off: 0.0 },
        { id: NETHER_BIOMES.crimson_forest,    tx: 0.4,  hy: 0.0,  off: 0.0 },
        { id: NETHER_BIOMES.warped_forest,     tx: 0.0,  hy: 0.5,  off: 0.375 * 0.375 },
        { id: NETHER_BIOMES.basalt_deltas,     tx: -0.5, hy: 0.0,  off: 0.175 * 0.175 }
      ];

      let bestDist = Infinity;
      let bestId = NETHER_BIOMES.nether_wastes;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const dx = p.tx - temp;
        const dy = p.hy - hum;
        const dsq = dx * dx + dy * dy + p.off;
        if (dsq < bestDist) {
          bestDist = dsq;
          bestId = p.id;
        }
      }

      return bestId;
    }

    /**
     * Generates a 2D grid of Nether biome IDs at scale 1:4.
     */
    getBiomes(x, z, w, h) {
      const out = new Int32Array(w * h);
      let idx = 0;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          out[idx++] = this.getBiomeAtQuart(x + i, z + j);
        }
      }
      return out;
    }

    /**
     * Get single biome ID at block coordinates (bx, bz).
     */
    getBiomeAtBlock(bx, bz) {
      const qx = Math.floor(bx / 4);
      const qz = Math.floor(bz / 4);
      return this.getBiomeAtQuart(qx, qz);
    }

    /**
     * Helper to get biome metadata (name, color).
     */
    getBiomeMeta(id) {
      const meta = NETHER_META[id] || { name: `Nether Biome ${id}`, color: '#bf3b3b' };
      return {
        id,
        name: meta.name,
        color: meta.color
      };
    }
  }

  // Export
  root.NetherGenerator = NetherGenerator;
  root.NETHER_BIOMES = NETHER_BIOMES;
  root.NETHER_META = NETHER_META;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NetherGenerator, NETHER_BIOMES, NETHER_META };
  }
})(typeof window !== 'undefined' ? window : globalThis);
