/**
 * Cubiomes Biomes Module (Pure JavaScript Port)
 * --------------------------------------------
 * Direct port of cubiomes/biomes.h and cubiomes/biomes.c
 * Target: Minecraft Java Edition 1.16.1
 */

(function (root) {
  'use strict';

  // 1. Biome ID Enumeration (Exact match with Minecraft Java 1.16)
  const BiomeID = {
    none: -1,
    ocean: 0,
    plains: 1,
    desert: 2,
    mountains: 3,
    forest: 4,
    taiga: 5,
    swamp: 6,
    river: 7,
    nether_wastes: 8,
    the_end: 9,
    frozen_ocean: 10,
    frozen_river: 11,
    snowy_tundra: 12,
    snowy_mountains: 13,
    mushroom_fields: 14,
    mushroom_field_shore: 15,
    beach: 16,
    desert_hills: 17,
    wooded_hills: 18,
    taiga_hills: 19,
    mountain_edge: 20,
    jungle: 21,
    jungle_hills: 22,
    jungle_edge: 23,
    deep_ocean: 24,
    stone_shore: 25,
    snowy_beach: 26,
    birch_forest: 27,
    birch_forest_hills: 28,
    dark_forest: 29,
    snowy_taiga: 30,
    snowy_taiga_hills: 31,
    giant_tree_taiga: 32,
    giant_tree_taiga_hills: 33,
    wooded_mountains: 34,
    savanna: 35,
    savanna_plateau: 36,
    badlands: 37,
    wooded_badlands_plateau: 38,
    badlands_plateau: 39,

    // 1.13 Ocean variants
    warm_ocean: 44,
    lukewarm_ocean: 45,
    cold_ocean: 46,
    deep_warm_ocean: 47,
    deep_lukewarm_ocean: 48,
    deep_cold_ocean: 49,
    deep_frozen_ocean: 50,

    the_void: 127,

    // Mutated variants (+128)
    sunflower_plains: 129,
    desert_lakes: 130,
    gravelly_mountains: 131,
    flower_forest: 132,
    taiga_mountains: 133,
    swamp_hills: 134,
    ice_spikes: 140,
    modified_jungle: 149,
    modified_jungle_edge: 151,
    tall_birch_forest: 155,
    tall_birch_hills: 156,
    dark_forest_hills: 157,
    snowy_taiga_mountains: 158,
    giant_spruce_taiga: 160,
    giant_spruce_taiga_hills: 161,
    modified_gravelly_mountains: 162,
    shattered_savanna: 163,
    shattered_savanna_plateau: 164,
    eroded_badlands: 165,
    modified_wooded_badlands_plateau: 166,
    modified_badlands_plateau: 167,

    // 1.14 Bamboo
    bamboo_jungle: 168,
    bamboo_jungle_hills: 169
  };

  // 2. Human-Readable Biome Names
  const BiomeNames = {
    [BiomeID.ocean]: 'Ocean',
    [BiomeID.plains]: 'Plains',
    [BiomeID.desert]: 'Desert',
    [BiomeID.mountains]: 'Mountains',
    [BiomeID.forest]: 'Forest',
    [BiomeID.taiga]: 'Taiga',
    [BiomeID.swamp]: 'Swamp',
    [BiomeID.river]: 'River',
    [BiomeID.frozen_ocean]: 'Frozen Ocean',
    [BiomeID.frozen_river]: 'Frozen River',
    [BiomeID.snowy_tundra]: 'Snowy Tundra',
    [BiomeID.snowy_mountains]: 'Snowy Mountains',
    [BiomeID.mushroom_fields]: 'Mushroom Fields',
    [BiomeID.mushroom_field_shore]: 'Mushroom Field Shore',
    [BiomeID.beach]: 'Beach',
    [BiomeID.desert_hills]: 'Desert Hills',
    [BiomeID.wooded_hills]: 'Wooded Hills',
    [BiomeID.taiga_hills]: 'Taiga Hills',
    [BiomeID.mountain_edge]: 'Mountain Edge',
    [BiomeID.jungle]: 'Jungle',
    [BiomeID.jungle_hills]: 'Jungle Hills',
    [BiomeID.jungle_edge]: 'Jungle Edge',
    [BiomeID.deep_ocean]: 'Deep Ocean',
    [BiomeID.stone_shore]: 'Stone Shore',
    [BiomeID.snowy_beach]: 'Snowy Beach',
    [BiomeID.birch_forest]: 'Birch Forest',
    [BiomeID.birch_forest_hills]: 'Birch Forest Hills',
    [BiomeID.dark_forest]: 'Dark Forest',
    [BiomeID.snowy_taiga]: 'Snowy Taiga',
    [BiomeID.snowy_taiga_hills]: 'Snowy Taiga Hills',
    [BiomeID.giant_tree_taiga]: 'Giant Tree Taiga',
    [BiomeID.giant_tree_taiga_hills]: 'Giant Tree Taiga Hills',
    [BiomeID.wooded_mountains]: 'Wooded Mountains',
    [BiomeID.savanna]: 'Savanna',
    [BiomeID.savanna_plateau]: 'Savanna Plateau',
    [BiomeID.badlands]: 'Badlands',
    [BiomeID.wooded_badlands_plateau]: 'Wooded Badlands Plateau',
    [BiomeID.badlands_plateau]: 'Badlands Plateau',
    [BiomeID.warm_ocean]: 'Warm Ocean',
    [BiomeID.lukewarm_ocean]: 'Lukewarm Ocean',
    [BiomeID.cold_ocean]: 'Cold Ocean',
    [BiomeID.deep_warm_ocean]: 'Deep Warm Ocean',
    [BiomeID.deep_lukewarm_ocean]: 'Deep Lukewarm Ocean',
    [BiomeID.deep_cold_ocean]: 'Deep Cold Ocean',
    [BiomeID.deep_frozen_ocean]: 'Deep Frozen Ocean',
    [BiomeID.sunflower_plains]: 'Sunflower Plains',
    [BiomeID.desert_lakes]: 'Desert Lakes',
    [BiomeID.gravelly_mountains]: 'Gravelly Mountains',
    [BiomeID.flower_forest]: 'Flower Forest',
    [BiomeID.taiga_mountains]: 'Taiga Mountains',
    [BiomeID.swamp_hills]: 'Swamp Hills',
    [BiomeID.ice_spikes]: 'Ice Spikes',
    [BiomeID.modified_jungle]: 'Modified Jungle',
    [BiomeID.modified_jungle_edge]: 'Modified Jungle Edge',
    [BiomeID.tall_birch_forest]: 'Tall Birch Forest',
    [BiomeID.tall_birch_hills]: 'Tall Birch Hills',
    [BiomeID.dark_forest_hills]: 'Dark Forest Hills',
    [BiomeID.snowy_taiga_mountains]: 'Snowy Taiga Mountains',
    [BiomeID.giant_spruce_taiga]: 'Giant Spruce Taiga',
    [BiomeID.giant_spruce_taiga_hills]: 'Giant Spruce Taiga Hills',
    [BiomeID.modified_gravelly_mountains]: 'Modified Gravelly Mountains',
    [BiomeID.shattered_savanna]: 'Shattered Savanna',
    [BiomeID.shattered_savanna_plateau]: 'Shattered Savanna Plateau',
    [BiomeID.eroded_badlands]: 'Eroded Badlands',
    [BiomeID.modified_wooded_badlands_plateau]: 'Modified Wooded Badlands Plateau',
    [BiomeID.modified_badlands_plateau]: 'Modified Badlands Plateau',
    [BiomeID.bamboo_jungle]: 'Bamboo Jungle',
    [BiomeID.bamboo_jungle_hills]: 'Bamboo Jungle Hills'
  };

  // 3. Biome Classification Helpers (from cubiomes/biomes.c)
  function isOceanic(id) {
    switch (id) {
      case BiomeID.ocean:
      case BiomeID.deep_ocean:
      case BiomeID.warm_ocean:
      case BiomeID.lukewarm_ocean:
      case BiomeID.cold_ocean:
      case BiomeID.frozen_ocean:
      case BiomeID.deep_warm_ocean:
      case BiomeID.deep_lukewarm_ocean:
      case BiomeID.deep_cold_ocean:
      case BiomeID.deep_frozen_ocean:
        return true;
      default:
        return false;
    }
  }

  function isShallowOcean(id) {
    switch (id) {
      case BiomeID.ocean:
      case BiomeID.warm_ocean:
      case BiomeID.lukewarm_ocean:
      case BiomeID.cold_ocean:
      case BiomeID.frozen_ocean:
        return true;
      default:
        return false;
    }
  }

  function isDeepOcean(id) {
    switch (id) {
      case BiomeID.deep_ocean:
      case BiomeID.deep_warm_ocean:
      case BiomeID.deep_lukewarm_ocean:
      case BiomeID.deep_cold_ocean:
      case BiomeID.deep_frozen_ocean:
        return true;
      default:
        return false;
    }
  }

  function isMesa(id) {
    switch (id) {
      case BiomeID.badlands:
      case BiomeID.wooded_badlands_plateau:
      case BiomeID.badlands_plateau:
      case BiomeID.eroded_badlands:
      case BiomeID.modified_wooded_badlands_plateau:
      case BiomeID.modified_badlands_plateau:
        return true;
      default:
        return false;
    }
  }

  function isSnowy(id) {
    switch (id) {
      case BiomeID.frozen_ocean:
      case BiomeID.frozen_river:
      case BiomeID.snowy_tundra:
      case BiomeID.snowy_mountains:
      case BiomeID.ice_spikes:
      case BiomeID.snowy_beach:
      case BiomeID.snowy_taiga:
      case BiomeID.snowy_taiga_hills:
      case BiomeID.snowy_taiga_mountains:
        return true;
      default:
        return false;
    }
  }

  function areSimilar(id1, id2) {
    if (id1 === id2) return true;
    if (isMesa(id1) && isMesa(id2)) return true;
    if (isOceanic(id1) && isOceanic(id2)) return true;

    // Mutated base check
    const base1 = (id1 >= 128 && id1 <= 167) ? (id1 - 128) : id1;
    const base2 = (id2 >= 128 && id2 <= 167) ? (id2 - 128) : id2;
    if (base1 === base2) return true;

    // Wooded hills & forest
    if ((id1 === BiomeID.wooded_hills || id1 === BiomeID.forest) && (id2 === BiomeID.wooded_hills || id2 === BiomeID.forest)) return true;
    if ((id1 === BiomeID.taiga_hills || id1 === BiomeID.taiga) && (id2 === BiomeID.taiga_hills || id2 === BiomeID.taiga)) return true;
    if ((id1 === BiomeID.desert_hills || id1 === BiomeID.desert) && (id2 === BiomeID.desert_hills || id2 === BiomeID.desert)) return true;
    if ((id1 === BiomeID.birch_forest_hills || id1 === BiomeID.birch_forest) && (id2 === BiomeID.birch_forest_hills || id2 === BiomeID.birch_forest)) return true;

    return false;
  }

  function getMutated(id) {
    switch (id) {
      case BiomeID.plains: return BiomeID.sunflower_plains;
      case BiomeID.desert: return BiomeID.desert_lakes;
      case BiomeID.mountains: return BiomeID.gravelly_mountains;
      case BiomeID.forest: return BiomeID.flower_forest;
      case BiomeID.taiga: return BiomeID.taiga_mountains;
      case BiomeID.swamp: return BiomeID.swamp_hills;
      case BiomeID.snowy_tundra: return BiomeID.ice_spikes;
      case BiomeID.jungle: return BiomeID.modified_jungle;
      case BiomeID.jungle_edge: return BiomeID.modified_jungle_edge;
      case BiomeID.birch_forest: return BiomeID.tall_birch_forest;
      case BiomeID.birch_forest_hills: return BiomeID.tall_birch_hills;
      case BiomeID.dark_forest: return BiomeID.dark_forest_hills;
      case BiomeID.snowy_taiga: return BiomeID.snowy_taiga_mountains;
      case BiomeID.giant_tree_taiga: return BiomeID.giant_spruce_taiga;
      case BiomeID.giant_tree_taiga_hills: return BiomeID.giant_spruce_taiga_hills;
      case BiomeID.wooded_mountains: return BiomeID.modified_gravelly_mountains;
      case BiomeID.savanna: return BiomeID.shattered_savanna;
      case BiomeID.savanna_plateau: return BiomeID.shattered_savanna_plateau;
      case BiomeID.badlands: return BiomeID.eroded_badlands;
      case BiomeID.wooded_badlands_plateau: return BiomeID.modified_wooded_badlands_plateau;
      case BiomeID.badlands_plateau: return BiomeID.modified_badlands_plateau;
      default: return id;
    }
  }

  // 4. Authentic Chunkbase & Cubiomes Color Palette (RGBA uint32 packed)
  function getBiomeColor(id) {
    switch (id) {
      /* Ocean */
      case BiomeID.ocean:
      case BiomeID.warm_ocean:
        return 0x000070;
      case BiomeID.lukewarm_ocean:
        return 0x000090;
      case BiomeID.cold_ocean:
        return 0x202070;
      case BiomeID.frozen_ocean:
        return 0x7070A0;
      case BiomeID.deep_ocean:
      case BiomeID.deep_warm_ocean:
      case BiomeID.deep_lukewarm_ocean:
        return 0x000030;
      case BiomeID.deep_cold_ocean:
        return 0x101040;
      case BiomeID.deep_frozen_ocean:
        return 0x404090;

      /* River */
      case BiomeID.river:
        return 0x0000FF;
      case BiomeID.frozen_river:
        return 0xA0A0FF;

      /* Snow / Ice */
      case BiomeID.snowy_tundra:
      case BiomeID.snowy_mountains:
        return 0xFFFFFF;
      case BiomeID.ice_spikes:
        return 0xB0E0FF;
      case BiomeID.snowy_beach:
        return 0xDDEEFF;

      /* Desert */
      case BiomeID.desert:
      case BiomeID.desert_hills:
      case BiomeID.desert_lakes:
        return 0xFA9418;

      /* Badlands / Mesa */
      case BiomeID.badlands:
      case BiomeID.badlands_plateau:
      case BiomeID.modified_badlands_plateau:
        return 0xD94515;
      case BiomeID.wooded_badlands_plateau:
      case BiomeID.modified_wooded_badlands_plateau:
        return 0xB06020;
      case BiomeID.eroded_badlands:
        return 0xFF6F3F;

      /* Plains & Forest */
      case BiomeID.plains:
      case BiomeID.sunflower_plains:
        return 0x8DB360;
      case BiomeID.forest:
      case BiomeID.wooded_hills:
        return 0x056621;
      case BiomeID.flower_forest:
        return 0x2D8E49;
      case BiomeID.birch_forest:
      case BiomeID.birch_forest_hills:
      case BiomeID.tall_birch_forest:
      case BiomeID.tall_birch_hills:
        return 0x307444;
      case BiomeID.dark_forest:
      case BiomeID.dark_forest_hills:
        return 0x40511A;

      /* Taiga */
      case BiomeID.taiga:
      case BiomeID.taiga_hills:
      case BiomeID.taiga_mountains:
        return 0x0B6659;
      case BiomeID.snowy_taiga:
      case BiomeID.snowy_taiga_hills:
      case BiomeID.snowy_taiga_mountains:
        return 0x31554A;
      case BiomeID.giant_tree_taiga:
      case BiomeID.giant_tree_taiga_hills:
      case BiomeID.giant_spruce_taiga:
      case BiomeID.giant_spruce_taiga_hills:
        return 0x596651;

      /* Swamp */
      case BiomeID.swamp:
      case BiomeID.swamp_hills:
        return 0x07F9B2;

      /* Jungle */
      case BiomeID.jungle:
      case BiomeID.jungle_hills:
      case BiomeID.modified_jungle:
        return 0x537B09;
      case BiomeID.jungle_edge:
      case BiomeID.modified_jungle_edge:
        return 0x628B17;
      case BiomeID.bamboo_jungle:
      case BiomeID.bamboo_jungle_hills:
        return 0x768E14;

      /* Savanna */
      case BiomeID.savanna:
      case BiomeID.savanna_plateau:
      case BiomeID.shattered_savanna:
      case BiomeID.shattered_savanna_plateau:
        return 0xBDB25F;

      /* Beach & Shore */
      case BiomeID.beach:
        return 0xFADE55;
      case BiomeID.stone_shore:
        return 0xA2A284;

      /* Mountains */
      case BiomeID.mountains:
      case BiomeID.wooded_mountains:
      case BiomeID.gravelly_mountains:
      case BiomeID.modified_gravelly_mountains:
      case BiomeID.mountain_edge:
        return 0x606060;

      /* Mushroom */
      case BiomeID.mushroom_fields:
        return 0xFF00FF;
      case BiomeID.mushroom_field_shore:
        return 0xA000FF;

      default:
        return 0x8DB360;
    }
  }

  // Export
  const CubiomesBiomes = {
    BiomeID,
    BiomeNames,
    getBiomeName: (id) => BiomeNames[id] || `Biome #${id}`,
    getBiomeColor,
    isOceanic,
    isShallowOcean,
    isDeepOcean,
    isMesa,
    isSnowy,
    areSimilar,
    getMutated
  };

  root.CubiomesBiomes = CubiomesBiomes;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CubiomesBiomes;
  }
})(typeof window !== 'undefined' ? window : globalThis);
