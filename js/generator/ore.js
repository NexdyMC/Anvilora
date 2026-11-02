/**
 * Minecraft Java 1.16.1 Underground Ore Generator
 * -----------------------------------------------
 * Authentic 1.16 Overworld Ore Distribution:
 * - Coal Ore: Y=0..127 (size 17, 20 veins/chunk)
 * - Iron Ore: Y=0..63 (size 9, 20 veins/chunk)
 * - Gold Ore: Y=0..31 (size 9, 2 veins/chunk)
 * - Redstone Ore: Y=0..16 (size 8, 8 veins/chunk)
 * - Lapis Ore: Y=0..30 (size 7, 1 vein/chunk, peak Y=14..16)
 * - Diamond Ore: Y=1..16 (size 8, 1 vein/chunk, sweet spot Y=11..12)
 *
 * Replaces ONLY minecraft:stone (ID 1).
 */

(function (root) {
  'use strict';

  const ORE_IDS = {
    COAL: 13,
    IRON: 14,
    GOLD: 15,
    REDSTONE: 16,
    DIAMOND: 17,
    LAPIS: 18
  };

  const ORE_CONFIGS = [
    { type: 'coal', id: ORE_IDS.COAL, count: 20, size: 17, minY: 5, maxY: 75 },
    { type: 'iron', id: ORE_IDS.IRON, count: 20, size: 9, minY: 5, maxY: 63 },
    { type: 'gold', id: ORE_IDS.GOLD, count: 2, size: 9, minY: 5, maxY: 31 },
    { type: 'redstone', id: ORE_IDS.REDSTONE, count: 8, size: 8, minY: 1, maxY: 16 },
    { type: 'lapis', id: ORE_IDS.LAPIS, count: 1, size: 7, minY: 10, maxY: 25 },
    { type: 'diamond', id: ORE_IDS.DIAMOND, count: 1, size: 8, minY: 2, maxY: 16 }
  ];

  /**
   * Generates ore veins for a given chunk (cx, cz)
   */
  function generateChunkOres(seed, cx, cz) {
    const s = typeof seed === 'bigint' ? seed : BigInt(seed);
    const JavaRandomClass = root.JavaRandom || (typeof require !== 'undefined' ? require('./noise.js').JavaRandom : null);
    if (!JavaRandomClass) {
      throw new Error('JavaRandom class not found. Ensure noise.js is loaded first.');
    }

    // Chunk-specific deterministic seed: seed + (cx * 341873128712) + (cz * 132897987541)
    const chunkSeed = BigInt.asIntN(64, s + BigInt(cx) * 341873128712n + BigInt(cz) * 132897987541n);
    const rnd = new JavaRandomClass(chunkSeed);

    const cStartX = cx * 16;
    const cStartZ = cz * 16;
    const veins = [];

    for (const cfg of ORE_CONFIGS) {
      for (let i = 0; i < cfg.count; i++) {
        const originX = cStartX + rnd.nextInt(16);
        const originZ = cStartZ + rnd.nextInt(16);
        const yRange = cfg.maxY - cfg.minY + 1;
        const originY = cfg.minY + (yRange > 0 ? rnd.nextInt(yRange) : 0);

        // 3D Ellipsoid cluster points
        const angle = (rnd.nextInt(1000) / 1000.0) * Math.PI;
        const spread = (cfg.size / 8.0);
        const x1 = originX + Math.sin(angle) * spread;
        const x2 = originX - Math.sin(angle) * spread;
        const z1 = originZ + Math.cos(angle) * spread;
        const z2 = originZ - Math.cos(angle) * spread;
        const y1 = originY + rnd.nextInt(3) - 1;
        const y2 = originY + rnd.nextInt(3) - 1;

        const blocks = [];

        for (let step = 0; step < cfg.size; step++) {
          const progress = step / Math.max(1, cfg.size - 1);
          const cxBlock = x1 + (x2 - x1) * progress;
          const cyBlock = y1 + (y2 - y1) * progress;
          const czBlock = z1 + (z2 - z1) * progress;

          // Radius tapers at both ends
          const rad = (Math.sin(progress * Math.PI) * 1.5 + 0.5) / 2.0;
          const minBX = Math.floor(cxBlock - rad);
          const maxBX = Math.floor(cxBlock + rad);
          const minBY = Math.floor(cyBlock - rad);
          const maxBY = Math.floor(cyBlock + rad);
          const minBZ = Math.floor(czBlock - rad);
          const maxBZ = Math.floor(czBlock + rad);

          for (let by = minBY; by <= maxBY; by++) {
            if (by <= 0 || by >= 128) continue; // Never replace Y=0 bedrock
            const dy = (by + 0.5 - cyBlock) / rad;
            if (dy * dy > 1.0) continue;

            for (let bz = minBZ; bz <= maxBZ; bz++) {
              const dz = (bz + 0.5 - czBlock) / rad;
              if (dy * dy + dz * dz > 1.0) continue;

              for (let bx = minBX; bx <= maxBX; bx++) {
                const dx = (bx + 0.5 - cxBlock) / rad;
                if (dx * dx + dy * dy + dz * dz <= 1.0) {
                  blocks.push({ x: bx, y: by, z: bz });
                }
              }
            }
          }
        }

        if (blocks.length > 0) {
          veins.push({
            type: cfg.type,
            oreId: cfg.id,
            blocks: blocks
          });
        }
      }
    }

    return veins;
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ORE_IDS, ORE_CONFIGS, generateChunkOres };
  } else {
    root.ORE_IDS = ORE_IDS;
    root.ORE_CONFIGS = ORE_CONFIGS;
    root.generateChunkOres = generateChunkOres;
  }
})(typeof window !== 'undefined' ? window : globalThis);
