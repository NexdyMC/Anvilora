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
      const JavaRandomClass = root.JavaRandom || (typeof require !== 'undefined' ? require('./noise.js').JavaRandom : null);
      if (!NoiseClass) {
        throw new Error('PerlinNoise2D class not found. Ensure noise.js is loaded first.');
      }
      this.noise1 = new NoiseClass(s);
      this.noise2 = new NoiseClass(s + 101n);
      this.noise3 = new NoiseClass(s + 202n);

      // In Minecraft Java, each octave is offset by seed coordinates so (0,0) does not always sample at (0,0)
      if (JavaRandomClass) {
        const rnd = new JavaRandomClass(s);
        this.ox1 = rnd.nextInt(20000) - 10000;
        this.oz1 = rnd.nextInt(20000) - 10000;
        this.ox2 = rnd.nextInt(20000) - 10000;
        this.oz2 = rnd.nextInt(20000) - 10000;
        this.ox3 = rnd.nextInt(20000) - 10000;
        this.oz3 = rnd.nextInt(20000) - 10000;
      } else {
        this.ox1 = 0; this.oz1 = 0;
        this.ox2 = 0; this.oz2 = 0;
        this.ox3 = 0; this.oz3 = 0;
      }
    }

    getHeight(x, z, biomeGen = null) {
      // 3 Octaves: Low freq (broad hills), Mid freq (contours), High freq (micro surface)
      const n1 = this.noise1.sample((x + this.ox1) * 0.03, (z + this.oz1) * 0.03) * 4.5;
      const n2 = this.noise2.sample((x + this.ox2) * 0.08, (z + this.oz2) * 0.08) * 2.0;
      const n3 = this.noise3.sample((x + this.ox3) * 0.18, (z + this.oz3) * 0.18) * 0.8;
      const total = n1 + n2 + n3;

      let baseH = 66.0;
      let minH = 62;
      let maxH = 72;

      if (biomeGen) {
        const bId = biomeGen.getBiomeAt(x, z, 64);
        // Oceanic biomes (0: ocean, 10: frozen, 24: deep, 44: lukewarm, 45: cold, 46: deep_cold, etc.)
        const isOcean = (bId === 0 || bId === 10 || bId === 24 || bId === 44 || bId === 45 || bId === 46 || bId === 47 || bId === 48 || bId === 49 || bId === 50);
        const isRiver = (bId === 7 || bId === 11);
        const isBeach = (bId === 16 || bId === 25 || bId === 26);
        const isMountain = (bId === 3 || bId === 13 || bId === 34 || bId === 131 || bId === 162);

        if (isOcean) {
          baseH = (bId === 24 || bId >= 47) ? 46.0 : 54.0;
          minH = 40;
          maxH = 58;
        } else if (isRiver) {
          baseH = 59.0;
          minH = 56;
          maxH = 61;
        } else if (isBeach) {
          baseH = 63.0;
          minH = 62;
          maxH = 64;
        } else if (isMountain) {
          baseH = 74.0;
          minH = 68;
          maxH = 88;
        }
      }

      const h = Math.round(baseH + total * (baseH < 62 ? 0.6 : 1.0));
      return Math.max(minH, Math.min(maxH, h));
    }
  }

  /**
   * Deterministic Oak Tree Placement Generator
   * Generates natural oak tree positions across the 3x3 spawn chunks (X=0..47, Z=0..47)
   */
  function getTreeLocations(seed, terrain, isFlat = false) {
    if (isFlat || !terrain) return [];

    const s = typeof seed === 'bigint' ? seed : BigInt(seed);
    const JavaRandomClass = root.JavaRandom || (typeof require !== 'undefined' ? require('./noise.js').JavaRandom : null);
    if (!JavaRandomClass) {
      throw new Error('JavaRandom class not found. Ensure noise.js is loaded first.');
    }

    const rnd = new JavaRandomClass(s + 55555n);
    const trees = [];
    const minDistanceSq = 5 * 5; // Minimum 5 blocks distance between tree trunks

    // Grid jitter over the 48x48 spawn area (6x6 cells of 8x8 blocks)
    for (let gridZ = 0; gridZ < 6; gridZ++) {
      for (let gridX = 0; gridX < 6; gridX++) {
        // ~60% chance to generate a tree in this cell
        if (rnd.nextInt(100) > 40) {
          const tx = gridX * 8 + 2 + rnd.nextInt(4);
          const tz = gridZ * 8 + 2 + rnd.nextInt(4);

          // Keep immediate spawn area clear (Chunk 0,0 center at X=8, Z=8)
          if (Math.abs(tx - 8) <= 2 && Math.abs(tz - 8) <= 2) continue;

          // Check distance to existing trees
          let tooClose = false;
          for (const t of trees) {
            const dx = t.x - tx;
            const dz = t.z - tz;
            if (dx * dx + dz * dz < minDistanceSq) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;

          const groundY = terrain.getHeight(tx, tz);
          // Only plant trees on grass above sea level (Y >= 63)
          if (groundY >= 63) {
            // Trunk height 4 or 5 blocks; if groundY >= 71 clamp to 4 to stay strictly within Section 4 (Y <= 79)
            const trunkHeight = (groundY >= 71) ? 4 : (4 + rnd.nextInt(2));
            trees.push({
              x: tx,
              z: tz,
              y: groundY,
              trunkHeight: trunkHeight
            });
          }
        }
      }
    }

    return trees;
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RollingPlainsTerrain, getTreeLocations };
  } else {
    root.RollingPlainsTerrain = RollingPlainsTerrain;
    root.getTreeLocations = getTreeLocations;
  }
})(typeof window !== 'undefined' ? window : globalThis);
