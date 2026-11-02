/**
 * Minecraft 1.16.1 Surface Flora & Decoration Generator
 * -----------------------------------------------------
 * Surface plant decorations:
 * - Plains & Forest: Grass, Red Poppies, Yellow Dandelions
 * - Desert: Cacti (2-blocks tall) & Dead Bushes
 * - Taiga: Grass & occasional Ferns/Poppies
 */

(function (root) {
  'use strict';

  const FLORA_IDS = {
    GRASS: 20,
    POPPY: 21,
    DANDELION: 22,
    CACTUS: 23,
    DEAD_BUSH: 24
  };

  /**
   * Generates deterministic flora decorations for chunk (cx, cz)
   */
  function getChunkFlora(seed, cx, cz, terrain, biomeGen, trees = []) {
    if (!terrain) return [];

    const s = typeof seed === 'bigint' ? seed : BigInt(seed);
    const JavaRandomClass = root.JavaRandom || (typeof require !== 'undefined' ? require('./noise.js').JavaRandom : null);
    if (!JavaRandomClass) {
      throw new Error('JavaRandom class not found. Ensure noise.js is loaded first.');
    }

    // Chunk-deterministic seed
    const chunkSeed = BigInt.asIntN(64, s + BigInt(cx) * 58923141n + BigInt(cz) * 87612349n + 7777n);
    const rnd = new JavaRandomClass(chunkSeed);

    const cStartX = cx * 16;
    const cStartZ = cz * 16;
    const flora = [];

    // Quick lookup for tree trunk locations to avoid planting on trunks
    const treeTrunkSet = new Set();
    if (Array.isArray(trees)) {
      for (const t of trees) {
        treeTrunkSet.add(`${t.x},${t.z}`);
      }
    }

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const wx = cStartX + lx;
        const wz = cStartZ + lz;

        if (treeTrunkSet.has(`${wx},${wz}`)) continue;

        const h = terrain.getHeight(wx, wz);
        if (h < 63) continue; // No surface flora underwater

        const bId = biomeGen ? biomeGen.getBiomeAt(wx, wz, h) : 1;
        const isDesert = (bId === 2 || bId === 16);
        const isMountain = (bId === 3 && h >= 71);

        if (isMountain) continue; // Bare rocky peaks

        if (isDesert) {
          // Desert Flora: Cacti and Dead Bushes (~6% chance)
          if (rnd.nextInt(100) < 6) {
            const roll = rnd.nextInt(100);
            if (roll < 55) {
              // Cactus (2 blocks tall on sand)
              flora.push({
                x: wx,
                y: h + 1,
                z: wz,
                type: 'cactus',
                blockId: FLORA_IDS.CACTUS,
                height: 2
              });
            } else {
              // Dead Bush
              flora.push({
                x: wx,
                y: h + 1,
                z: wz,
                type: 'dead_bush',
                blockId: FLORA_IDS.DEAD_BUSH,
                height: 1
              });
            }
          }
        } else {
          // Plains, Forest, Taiga Flora (~20% chance)
          if (rnd.nextInt(100) < 20) {
            const roll = rnd.nextInt(100);
            if (roll < 72) {
              // Grass
              flora.push({
                x: wx,
                y: h + 1,
                z: wz,
                type: 'grass',
                blockId: FLORA_IDS.GRASS,
                height: 1
              });
            } else if (roll < 88) {
              // Red Poppy
              flora.push({
                x: wx,
                y: h + 1,
                z: wz,
                type: 'poppy',
                blockId: FLORA_IDS.POPPY,
                height: 1
              });
            } else {
              // Yellow Dandelion
              flora.push({
                x: wx,
                y: h + 1,
                z: wz,
                type: 'dandelion',
                blockId: FLORA_IDS.DANDELION,
                height: 1
              });
            }
          }
        }
      }
    }

    return flora;
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FLORA_IDS, getChunkFlora };
  } else {
    root.FLORA_IDS = FLORA_IDS;
    root.getChunkFlora = getChunkFlora;
  }
})(typeof window !== 'undefined' ? window : globalThis);
