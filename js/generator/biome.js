/**
 * Minecraft 1.16.1 Biome & Climate Generator
 * -------------------------------------------
 * - 2D Climate Simulation: Temperature & Moisture Noise
 * - Standard 1.16.1 Overworld Biome IDs
 * - Exact Map Cartography Biome Colors (from user's engine)
 * - Biome-adaptive surface block mappings (Sand/Sandstone for Desert, Grass/Dirt for Plains/Forest, Stone for Mountains)
 */

(function (root) {
  'use strict';

  // Official Minecraft Java Edition 1.16.1 Numeric Biome IDs
  const BIOME_IDS = {
    OCEAN: 0,
    PLAINS: 1,
    DESERT: 2,
    MOUNTAINS: 3,
    FOREST: 4,
    TAIGA: 5,
    SWAMP: 6,
    RIVER: 7,
    BEACH: 16,
    BIRCH_FOREST: 27,
    DARK_FOREST: 29,
    SNOWY_TAIGA: 30,
    SAVANNA: 35,
    BADLANDS: 37
  };

  /**
   * Biome Hex Colors matching authentic Minecraft cartography & user project
   */
  function getBiomeColor(biome) {
    switch (biome) {
      /* ================= OCEAN ================= */
      case BIOME_IDS.OCEAN:
        return 0x000070;

      /* ================= RIVER ================= */
      case BIOME_IDS.RIVER:
        return 0x0000FF;

      /* ================= DESERT ================= */
      case BIOME_IDS.DESERT:
        return 0xFA9418;

      /* ================= BADLANDS ================= */
      case BIOME_IDS.BADLANDS:
        return 0xD94515;

      /* ================= PLAINS / FOREST ================= */
      case BIOME_IDS.PLAINS:
        return 0x8DB360;

      case BIOME_IDS.FOREST:
      case BIOME_IDS.BIRCH_FOREST:
        return 0x056621;

      case BIOME_IDS.DARK_FOREST:
        return 0x40511A;

      /* ================= SWAMP ================= */
      case BIOME_IDS.SWAMP:
        return 0x6A7039;

      /* ================= TAIGA ================= */
      case BIOME_IDS.TAIGA:
      case BIOME_IDS.SNOWY_TAIGA:
        return 0x4B6846;

      /* ================= SAVANNA ================= */
      case BIOME_IDS.SAVANNA:
        return 0xC9D29B;

      /* ================= BEACH ================= */
      case BIOME_IDS.BEACH:
        return 0xFADE55;

      /* ================= MOUNTAINS ================= */
      case BIOME_IDS.MOUNTAINS:
        return 0x7F8F7F;

      /* ================= DEFAULT ================= */
      default:
        return 0x7BA331; // fallback
    }
  }

  class BiomeGenerator {
    constructor(seed) {
      const s = typeof seed === 'bigint' ? seed : BigInt(seed);
      const NoiseClass = root.PerlinNoise2D || (typeof require !== 'undefined' ? require('./noise.js').PerlinNoise2D : null);
      const JavaRandomClass = root.JavaRandom || (typeof require !== 'undefined' ? require('./noise.js').JavaRandom : null);

      if (!NoiseClass || !JavaRandomClass) {
        throw new Error('Noise dependencies not found. Ensure noise.js is loaded first.');
      }

      this.tempNoise = new NoiseClass(s + 1111n);
      this.moistNoise = new NoiseClass(s + 2222n);

      const rnd = new JavaRandomClass(s + 3333n);
      this.tox = rnd.nextInt(20000) - 10000;
      this.toz = rnd.nextInt(20000) - 10000;
      this.mox = rnd.nextInt(20000) - 10000;
      this.moz = rnd.nextInt(20000) - 10000;
    }

    /**
     * Samples temperature at world coordinates (normalized roughly -1.0 .. +1.0)
     */
    getTemperature(x, z) {
      return this.tempNoise.sample((x + this.tox) * 0.02, (z + this.toz) * 0.02);
    }

    /**
     * Samples moisture/humidity at world coordinates (normalized roughly -1.0 .. +1.0)
     */
    getMoisture(x, z) {
      return this.moistNoise.sample((x + this.mox) * 0.02, (z + this.moz) * 0.02);
    }

    /**
     * Resolves the Minecraft Biome ID at given (wx, wz, wy) coordinates
     */
    getBiomeAt(wx, wz, elevation = 65) {
      // Water level rule
      if (elevation <= 61) {
        return BIOME_IDS.RIVER;
      }
      if (elevation === 62) {
        return BIOME_IDS.BEACH;
      }

      // High peaks rule
      if (elevation >= 71) {
        return BIOME_IDS.MOUNTAINS;
      }

      const temp = this.getTemperature(wx, wz);
      const moist = this.getMoisture(wx, wz);

      // Climate Classification (Whittaker style)
      if (temp > 0.15 && moist < -0.05) {
        return BIOME_IDS.DESERT; // Hot and dry
      }
      if (temp < -0.15 && moist > 0.0) {
        return BIOME_IDS.TAIGA; // Cold
      }
      if (moist > 0.12) {
        // High humidity: Forest
        return temp > 0.0 ? BIOME_IDS.FOREST : BIOME_IDS.BIRCH_FOREST;
      }

      // Default temperate biome
      return BIOME_IDS.PLAINS;
    }

    /**
     * Returns surface and subsurface block configuration for the given biome
     */
    getSurfaceConfig(biomeId, elevation) {
      switch (biomeId) {
        case BIOME_IDS.DESERT:
        case BIOME_IDS.BEACH:
          return {
            topBlockId: 5,       // minecraft:sand
            subBlockId: 6,       // minecraft:sandstone
            subDepth: 4
          };

        case BIOME_IDS.MOUNTAINS:
          if (elevation >= 71) {
            return {
              topBlockId: 1,     // minecraft:stone
              subBlockId: 1,     // minecraft:stone
              subDepth: 0
            };
          }
          return {
            topBlockId: 3,       // minecraft:grass_block
            subBlockId: 2,       // minecraft:dirt
            subDepth: 3
          };

        case BIOME_IDS.FOREST:
        case BIOME_IDS.BIRCH_FOREST:
        case BIOME_IDS.TAIGA:
        case BIOME_IDS.PLAINS:
        default:
          return {
            topBlockId: 3,       // minecraft:grass_block
            subBlockId: 2,       // minecraft:dirt
            subDepth: 3
          };
      }
    }
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BIOME_IDS, getBiomeColor, BiomeGenerator };
  } else {
    root.BIOME_IDS = BIOME_IDS;
    root.getBiomeColor = getBiomeColor;
    root.BiomeGenerator = BiomeGenerator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
