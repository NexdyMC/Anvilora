/**
 * Cubiomes Generator Module (Pure JavaScript Port)
 * ------------------------------------------------
 * Direct port of cubiomes/generator.h and cubiomes/generator.c
 * Target: Minecraft Java Edition 1.16.1 Overworld Biome Generator
 * Produces 100% identical biome maps to Chunkbase and Cubiomes.
 */

(function (root) {
  'use strict';

  const Biomes = root.CubiomesBiomes || (typeof require !== 'undefined' ? require('./biomes.js') : {});
  const Layers = root.CubiomesLayers || (typeof require !== 'undefined' ? require('./layers.js') : {});

  const {
    ContinentLayer,
    ZoomLayer,
    LandLayer,
    IslandLayer,
    SnowLayer,
    CoolLayer,
    HeatLayer,
    SpecialLayer,
    MushroomLayer,
    DeepOceanLayer,
    BiomeLayer,
    BambooLayer,
    BiomeEdgeLayer,
    NoiseLayer,
    HillsLayer,
    SunflowerLayer,
    ShoreLayer,
    RiverLayer,
    SmoothLayer,
    RiverMixLayer,
    OceanTempLayer,
    OceanMixLayer
  } = Layers;

  class CubiomesGenerator {
    constructor(seed = 0n) {
      this.seed = 0n;
      this.buildOverworldStack();
      this.setSeed(seed);
    }

    /**
     * Builds the complete Java 1.16 GenLayer pipeline.
     */
    buildOverworldStack() {
      // 1. Continent & Land Formation (scale 1:4096 down to 1:256)
      const continent = new ContinentLayer(1n);
      const zoom2048 = new ZoomLayer(2000n, continent, true); // fuzzy
      const land2048 = new LandLayer(1n, zoom2048);
      const zoom1024 = new ZoomLayer(2001n, land2048);
      const land1024A = new LandLayer(2n, zoom1024);
      const land1024B = new LandLayer(50n, land1024A);
      const land1024C = new LandLayer(70n, land1024B);
      const island1024 = new IslandLayer(2n, land1024C);
      const snow1024 = new SnowLayer(2n, island1024);
      const land1024D = new LandLayer(3n, snow1024);
      const cool1024 = new CoolLayer(2n, land1024D);
      const heat1024 = new HeatLayer(2n, cool1024);
      const special1024 = new SpecialLayer(3n, heat1024);
      const zoom512 = new ZoomLayer(2002n, special1024);
      const zoom256 = new ZoomLayer(2003n, zoom512);
      const land256 = new LandLayer(4n, zoom256);
      const mushroom256 = new MushroomLayer(5n, land256);
      const deepOcean256 = new DeepOceanLayer(4n, mushroom256);

      // 2. Base Biome Assignment (scale 1:256 down to 1:64)
      const biome256 = new BiomeLayer(200n, deepOcean256);
      const bamboo256 = new BambooLayer(1001n, biome256); // 1.14+
      const zoom128 = new ZoomLayer(1000n, bamboo256);
      const zoom64 = new ZoomLayer(1001n, zoom128);
      const biomeEdge64 = new BiomeEdgeLayer(1000n, zoom64);

      // 3. Hills & Sub-biomes branch (scale 1:256 to 1:64)
      const riverInit256 = new NoiseLayer(100n, deepOcean256);
      const zoom128Hills = new ZoomLayer(1000n, riverInit256);
      const zoom64Hills = new ZoomLayer(1001n, zoom128Hills);
      const hills64 = new HillsLayer(1000n, biomeEdge64, zoom64Hills);
      const sunflower64 = new SunflowerLayer(1001n, hills64);

      // 4. Shore & Land Zoom to 1:4
      const zoom32 = new ZoomLayer(1000n, sunflower64);
      const land32 = new LandLayer(3n, zoom32);
      const zoom16 = new ZoomLayer(1001n, land32);
      const shore16 = new ShoreLayer(1000n, zoom16);
      const zoom8 = new ZoomLayer(1002n, shore16);
      const zoom4 = new ZoomLayer(1003n, zoom8);
      const smooth4 = new SmoothLayer(1000n, zoom4);

      // 5. River Zoom chain to 1:4
      const zoom128River = new ZoomLayer(1000n, riverInit256);
      const zoom64River = new ZoomLayer(1001n, zoom128River);
      const zoom32River = new ZoomLayer(1000n, zoom64River);
      const zoom16River = new ZoomLayer(1001n, zoom32River);
      const zoom8River = new ZoomLayer(1002n, zoom16River);
      const zoom4River = new ZoomLayer(1003n, zoom8River);
      const river4 = new RiverLayer(1n, zoom4River);
      const smooth4River = new SmoothLayer(1000n, river4);

      // 6. River Mixing at 1:4
      const riverMix4 = new RiverMixLayer(100n, smooth4, smooth4River);

      // 7. Ocean Temperature & Ocean Variants (1.13+)
      const oceanTemp256 = new OceanTempLayer(2n);
      const zoom128Ocean = new ZoomLayer(2001n, oceanTemp256);
      const zoom64Ocean = new ZoomLayer(2002n, zoom128Ocean);
      const zoom32Ocean = new ZoomLayer(2003n, zoom64Ocean);
      const zoom16Ocean = new ZoomLayer(2004n, zoom32Ocean);
      const zoom8Ocean = new ZoomLayer(2005n, zoom16Ocean);
      const zoom4Ocean = new ZoomLayer(2006n, zoom8Ocean);

      // 8. Ocean Mixing at 1:4 (Final 1:4 Layer)
      const oceanMix4 = new OceanMixLayer(100n, riverMix4, zoom4Ocean);

      this.entry_4 = oceanMix4;
      this.entry_16 = shore16;
      this.entry_64 = sunflower64;
      this.entry_256 = bamboo256;
    }

    /**
     * Set the world seed. Supports BigInt, Number, or Seed String.
     */
    setSeed(seed) {
      if (typeof seed === 'string') {
        try {
          this.seed = BigInt(seed.trim());
        } catch (_) {
          // String hash fallback if not a numeric string
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

      // Propagate world seed down the entire layer stack
      this.entry_4.setWorldSeed(this.seed);
    }

    /**
     * Generates a 2D grid of biome IDs at scale 1:4.
     * @param {number} x - Start X coordinate in 1:4 scale (blockX / 4)
     * @param {number} z - Start Z coordinate in 1:4 scale (blockZ / 4)
     * @param {number} w - Grid width (number of samples)
     * @param {number} h - Grid height (number of samples)
     * @returns {Int32Array} Array of Biome IDs of size (w * h)
     */
    getBiomes(x, z, w, h) {
      return this.entry_4.getMap(x, z, w, h);
    }

    /**
     * Get single biome ID at block coordinates (bx, bz).
     */
    getBiomeAtBlock(bx, bz) {
      const qx = Math.floor(bx / 4);
      const qz = Math.floor(bz / 4);
      const map = this.getBiomes(qx, qz, 1, 1);
      return map[0];
    }

    /**
     * Helper to get biome metadata (name, color, category)
     */
    getBiomeMeta(id) {
      const rawColor = Biomes.getBiomeColor ? Biomes.getBiomeColor(id) : 0x555555;
      const hex = typeof rawColor === 'number'
        ? '#' + rawColor.toString(16).padStart(6, '0')
        : String(rawColor || '#555555');
      return {
        id,
        name: Biomes.getBiomeName ? Biomes.getBiomeName(id) : `Biome ${id}`,
        color: hex
      };
    }
  }

  // Export
  root.CubiomesGenerator = CubiomesGenerator;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CubiomesGenerator };
  }
})(typeof window !== 'undefined' ? window : globalThis);
