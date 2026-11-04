/**
 * Overworld Chunk NBT Builder
 * ----------------------------
 * Assembles valid Anvil chunk NBT compound:
 * - 1024 Biomes ints (minecraft:plains)
 * - 16x16 column surface height calculation
 * - 5 vertical sections (Y=0..4, covering Y=0..79):
 *   - Section 0: Y=0 Bedrock, Y=1..15 Stone
 *   - Section 1 & 2: 100% Solid Stone (single palette)
 *   - Section 3 & 4: Stone, Dirt, Grass Block, Water with 64-bit BlockStates bit-packing
 */

(function (root) {
  'use strict';

  function buildTerrainChunkNbt(cx, cz, terrain, isFlat = false, trees = [], biomeGen = null, chunkOres = null, chunkFlora = null) {
    const NBTWriterClass = root.NBTWriter || (typeof require !== 'undefined' ? require('../core/nbt.js').NBTWriter : null);
    const tags = root.NBT_TAGS || (typeof require !== 'undefined' ? require('../core/nbt.js').NBT_TAGS : null);

    if (!NBTWriterClass || !tags) {
      throw new Error('NBTWriter or NBT_TAGS not found. Ensure nbt.js is loaded first.');
    }

    const nbt = new NBTWriterClass();

    // Root Compound (unnamed in Java edition)
    nbt.startCompound('');

    // Level Compound
    nbt.startCompound('Level');
    nbt.tagInt('xPos', cx);
    nbt.tagInt('zPos', cz);
    nbt.tagLong('LastUpdate', 0n);
    nbt.tagLong('InhabitedTime', 0n);
    nbt.tagString('Status', 'full');
    nbt.tagInt('DataVersion', 2567);

    // Compute surface heights and column biomes for all 256 (16x16) columns in this chunk
    const heights = new Uint8Array(256);
    const columnSurfs = new Array(256);

    // Pre-sample 4x4 biomes at scale 1:4 (quart coordinates) for this chunk
    const quartBiomes = new Int32Array(16);
    for (let bz = 0; bz < 4; bz++) {
      const wz = cz * 16 + bz * 4 + 2;
      for (let bx = 0; bx < 4; bx++) {
        const wx = cx * 16 + bx * 4 + 2;
        quartBiomes[bz * 4 + bx] = biomeGen ? biomeGen.getBiomeAt(wx, wz, 64) : 1;
      }
    }

    // Biomes: 1024 ints (4x4x64 grid in Z, then X, then Y layout: idx = by*16 + bz*4 + bx)
    const biomes = new Int32Array(1024);
    for (let by = 0; by < 64; by++) {
      biomes.set(quartBiomes, by * 16);
    }
    nbt.tagIntArray('Biomes', biomes);

    // Pre-calculate heights and surface configurations for all 256 columns
    for (let z = 0; z < 16; z++) {
      const qz = Math.floor(z / 4);
      for (let x = 0; x < 16; x++) {
        const qx = Math.floor(x / 4);
        const idx = z * 16 + x;
        const wx = cx * 16 + x;
        const wz = cz * 16 + z;
        const h = isFlat ? 64 : (terrain ? terrain.getHeight(wx, wz) : 64);
        heights[idx] = h;

        const bId = quartBiomes[qz * 4 + qx];
        columnSurfs[idx] = biomeGen ? biomeGen.getSurfaceConfig(bId, h) : { topBlockId: (h >= 63 ? 3 : 2), subBlockId: 2, subDepth: 3 };
      }
    }

    // Number of active sections: Y=0..4 (Y=0 s/d 79)
    const numSections = 5;
    nbt.startList('Sections', tags.TAG_Compound, numSections);

    const cStartX = cx * 16;
    const cEndX = cStartX + 15;
    const cStartZ = cz * 16;
    const cEndZ = cStartZ + 15;

    for (let secY = 0; secY < numSections; secY++) {
      nbt.tagByte('Y', secY);
      const baseWorldY = secY * 16;

      const secBlocks = new Uint8Array(4096);
      const usedPalette = new Set();

      for (let localY = 0; localY < 16; localY++) {
        const worldY = baseWorldY + localY;
        for (let z = 0; z < 16; z++) {
          for (let x = 0; x < 16; x++) {
            const colIdx = z * 16 + x;
            const h = heights[colIdx];
            const surf = columnSurfs[colIdx];

            let blockId = 0; // 0 = air

            if (worldY === 0) {
              blockId = 19; // 19 = bedrock
            } else if (worldY < h - surf.subDepth) {
              blockId = 1; // 1 = stone
            } else if (worldY < h) {
              blockId = surf.subBlockId; // dirt or sandstone
            } else if (worldY === h) {
              blockId = (h >= 63) ? surf.topBlockId : (surf.topBlockId === 5 ? 5 : 2); // surface block
            } else if (worldY <= 62) {
              blockId = 4; // 4 = water
            } else {
              blockId = 0; // 0 = air
            }

            secBlocks[localY * 256 + colIdx] = blockId;
            usedPalette.add(blockId);
          }
        }
      }

      // Stamp Underground Ores (Coal, Iron, Gold, Redstone, Diamond, Lapis)
      // Only replaces solid stone (ID 1)
      if (Array.isArray(chunkOres) && chunkOres.length > 0) {
        for (const vein of chunkOres) {
          for (const b of vein.blocks) {
            if (b.y >= baseWorldY && b.y < baseWorldY + 16) {
              const lx = b.x - cStartX;
              const ly = b.y - baseWorldY;
              const lz = b.z - cStartZ;
              if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
                const idx = ly * 256 + lz * 16 + lx;
                if (secBlocks[idx] === 1) { // strictly replace stone only
                  secBlocks[idx] = vein.oreId;
                  usedPalette.add(vein.oreId);
                }
              }
            }
          }
        }
      }

      // Stamp Trees (Oak, Birch, Spruce) into this section if any intersect
      if (Array.isArray(trees) && trees.length > 0) {
        // Safe helper to stamp block within this section's bounds
        const stampBlock = (wx, wy, wz, blockId) => {
          if (wx < cStartX || wx > cEndX || wz < cStartZ || wz > cEndZ) return;
          if (wy < baseWorldY || wy >= baseWorldY + 16) return;
          const lx = wx - cStartX;
          const ly = wy - baseWorldY;
          const lz = wz - cStartZ;
          const idx = ly * 256 + lz * 16 + lx;
          const existing = secBlocks[idx];

          const isLog = (blockId === 7 || blockId === 9 || blockId === 11);
          const isLeaves = (blockId === 8 || blockId === 10 || blockId === 12);

          // Leaves only replace air; logs replace air or leaves
          if (isLog || (isLeaves && existing === 0)) {
            secBlocks[idx] = blockId;
            usedPalette.add(blockId);
          }
        };

        // Filter trees that could touch this chunk (including 2-block leaf radius)
        const relevantTrees = trees.filter(t =>
          t.x >= cStartX - 2 && t.x <= cEndX + 2 &&
          t.z >= cStartZ - 2 && t.z <= cEndZ + 2
        );

        const stampTreeFunc = root.stampTree || (typeof require !== 'undefined' ? require('./tree.js').stampTree : null);

        for (const t of relevantTrees) {
          if (stampTreeFunc) {
            stampTreeFunc(t, stampBlock);
          } else {
            // Fallback Oak Stamping
            const top = t.y + t.trunkHeight;
            const logId = t.logId || 7;
            const leafId = t.leavesId || 8;
            for (let ty = t.y + 1; ty <= top; ty++) stampBlock(t.x, ty, t.z, logId);
            for (let ly = top - 1; ly <= top; ly++) {
              for (let dz = -2; dz <= 2; dz++) {
                for (let dx = -2; dx <= 2; dx++) {
                  if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                  stampBlock(t.x + dx, ly, t.z + dz, leafId);
                }
              }
            }
          }
        }
      }

      // Stamp Surface Flora (Grass, Poppy, Dandelion, Cactus, Dead Bush)
      if (Array.isArray(chunkFlora) && chunkFlora.length > 0) {
        for (const f of chunkFlora) {
          for (let fy = 0; fy < f.height; fy++) {
            const wy = f.y + fy;
            if (wy >= baseWorldY && wy < baseWorldY + 16) {
              const lx = f.x - cStartX;
              const ly = wy - baseWorldY;
              const lz = f.z - cStartZ;
              if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
                const idx = ly * 256 + lz * 16 + lx;
                // Flora strictly only replaces air (ID 0)
                if (secBlocks[idx] === 0) {
                  secBlocks[idx] = f.blockId;
                  usedPalette.add(f.blockId);
                }
              }
            }
          }
        }
      }

      const paletteNames = [
        'minecraft:air',            // 0
        'minecraft:stone',          // 1
        'minecraft:dirt',           // 2
        'minecraft:grass_block',    // 3
        'minecraft:water',          // 4
        'minecraft:sand',           // 5
        'minecraft:sandstone',      // 6
        'minecraft:oak_log',        // 7
        'minecraft:oak_leaves',     // 8
        'minecraft:birch_log',      // 9
        'minecraft:birch_leaves',   // 10
        'minecraft:spruce_log',     // 11
        'minecraft:spruce_leaves',  // 12
        'minecraft:coal_ore',       // 13
        'minecraft:iron_ore',       // 14
        'minecraft:gold_ore',       // 15
        'minecraft:redstone_ore',   // 16
        'minecraft:diamond_ore',    // 17
        'minecraft:lapis_ore',      // 18
        'minecraft:bedrock',        // 19
        'minecraft:grass',          // 20
        'minecraft:poppy',          // 21
        'minecraft:dandelion',      // 22
        'minecraft:cactus',         // 23
        'minecraft:dead_bush'       // 24
      ];

      const sortedUsed = Array.from(usedPalette).sort((a, b) => a - b);
      const idToPaletteIndex = new Map();
      sortedUsed.forEach((id, idx) => idToPaletteIndex.set(id, idx));

      nbt.startList('Palette', tags.TAG_Compound, sortedUsed.length);
      for (const id of sortedUsed) {
        const name = paletteNames[id];
        nbt.tagString('Name', name);
        if (name === 'minecraft:grass_block') {
          nbt.startCompound('Properties');
          nbt.tagString('snowy', 'false');
          nbt.endCompound();
        } else if (name.endsWith('_log')) {
          nbt.startCompound('Properties');
          nbt.tagString('axis', 'y');
          nbt.endCompound();
        } else if (name.endsWith('_leaves')) {
          nbt.startCompound('Properties');
          nbt.tagString('distance', '1');
          nbt.tagString('persistent', 'true');
          nbt.endCompound();
        } else if (name === 'minecraft:cactus') {
          nbt.startCompound('Properties');
          nbt.tagString('age', '0');
          nbt.endCompound();
        }
        nbt.endCompound();
      }

      // Dynamic bits-per-block bit-packing (Minecraft 1.16+ DataVersion 2567 standard)
      if (sortedUsed.length > 1) {
        let bits = 4;
        while ((1 << bits) < sortedUsed.length) bits++;
        bits = Math.max(4, bits);

        const blocksPerLong = Math.floor(64 / bits);
        const numLongs = Math.ceil(4096 / blocksPerLong);
        const longs = new BigInt64Array(numLongs);
        const bitMask = (1n << BigInt(bits)) - 1n;

        for (let i = 0; i < 4096; i++) {
          const rawId = secBlocks[i];
          const pid = BigInt(idToPaletteIndex.get(rawId)) & bitMask;
          const longIdx = Math.floor(i / blocksPerLong);
          const bitOffset = BigInt((i % blocksPerLong) * bits);
          longs[longIdx] |= (pid << bitOffset);
        }
        nbt.tagLongArray('BlockStates', longs);
      }

      nbt.endCompound(); // End Section
    }

    // Heightmaps compound
    nbt.startCompound('Heightmaps');
    nbt.endCompound();

    nbt.endCompound(); // End Level
    nbt.endCompound(); // End Root

    return nbt.getBytes();
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildTerrainChunkNbt };
  } else {
    root.buildTerrainChunkNbt = buildTerrainChunkNbt;
  }
})(typeof window !== 'undefined' ? window : globalThis);
