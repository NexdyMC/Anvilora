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

  function buildTerrainChunkNbt(cx, cz, terrain, isFlat = false) {
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

    // Biomes: 1024 ints (all 1 = minecraft:plains)
    const biomes = new Int32Array(1024);
    biomes.fill(1);
    nbt.tagIntArray('Biomes', biomes);

    // Compute surface heights for all 256 (16x16) columns in this chunk
    const heights = new Uint8Array(256);
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const wx = cx * 16 + x;
        const wz = cz * 16 + z;
        heights[z * 16 + x] = isFlat ? 64 : terrain.getHeight(wx, wz);
      }
    }

    // Number of active sections: Y=0..4 (Y=0 s/d 79)
    const numSections = 5;
    nbt.startList('Sections', tags.TAG_Compound, numSections);

    for (let secY = 0; secY < numSections; secY++) {
      nbt.tagByte('Y', secY);
      const baseWorldY = secY * 16;

      // Section 1 & 2 (Y=16..47) are always 100% solid stone
      if (secY === 1 || secY === 2) {
        nbt.startList('Palette', tags.TAG_Compound, 1);
        nbt.tagString('Name', 'minecraft:stone');
        nbt.endCompound();
        // Palette of 1 item -> BlockStates omitted in Minecraft 1.16+
        nbt.endCompound();
        continue;
      }

      // Section 0 (Y=0..15): Y=0 is Bedrock, Y=1..15 is Stone
      if (secY === 0) {
        nbt.startList('Palette', tags.TAG_Compound, 2);
        nbt.tagString('Name', 'minecraft:bedrock');
        nbt.endCompound();
        nbt.tagString('Name', 'minecraft:stone');
        nbt.endCompound();

        const longs = new BigInt64Array(256);
        for (let i = 0; i < 4096; i++) {
          const y = i >> 8; // (i / 256)
          const pid = (y === 0) ? 0n : 1n;
          const longIdx = i >> 4;
          const bitOffset = BigInt((i & 15) << 2);
          longs[longIdx] |= (pid << bitOffset);
        }
        nbt.tagLongArray('BlockStates', longs);
        nbt.endCompound();
        continue;
      }

      // Sections 3 & 4 (Y=48..63 & Y=64..79): Dynamic terrain blocks
      const secBlocks = new Uint8Array(4096);
      const usedPalette = new Set();

      for (let localY = 0; localY < 16; localY++) {
        const worldY = baseWorldY + localY;
        for (let z = 0; z < 16; z++) {
          for (let x = 0; x < 16; x++) {
            const h = heights[z * 16 + x];
            let blockId = 0; // 0 = air

            if (worldY < h - 3) {
              blockId = 1; // 1 = stone
            } else if (worldY < h) {
              blockId = 2; // 2 = dirt
            } else if (worldY === h) {
              blockId = (h >= 63) ? 3 : 2; // 3 = grass_block, 2 = dirt
            } else if (worldY <= 62) {
              blockId = 4; // 4 = water
            } else {
              blockId = 0; // 0 = air
            }

            secBlocks[localY * 256 + z * 16 + x] = blockId;
            usedPalette.add(blockId);
          }
        }
      }

      const paletteNames = [
        'minecraft:air',
        'minecraft:stone',
        'minecraft:dirt',
        'minecraft:grass_block',
        'minecraft:water'
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
        }
        nbt.endCompound();
      }

      if (sortedUsed.length > 1) {
        const longs = new BigInt64Array(256);
        for (let i = 0; i < 4096; i++) {
          const rawId = secBlocks[i];
          const pid = BigInt(idToPaletteIndex.get(rawId));
          const longIdx = i >> 4;
          const bitOffset = BigInt((i & 15) << 2);
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
