/**
 * Minecraft Tree Template Toolkit (Oak, Birch, Spruce)
 * ---------------------------------------------------
 * Modular tree generation and stamping:
 * - OakTree: Classic rounded oak canopy (oak_log & oak_leaves)
 * - BirchTree: Slender, taller white birch (birch_log & birch_leaves)
 * - SpruceTree: Coniferous pine pyramid (spruce_log & spruce_leaves)
 * - Biome-adaptive tree placement:
 *   - Forest: High density Birch & Oak
 *   - Taiga: Coniferous Spruce pines
 *   - Plains: Scattered Oak & occasional Birch
 *   - Desert/Beach: 0 trees
 */

(function (root) {
  'use strict';

  // Tree block IDs within our chunk palette
  const TREE_BLOCKS = {
    OAK_LOG: 7,
    OAK_LEAVES: 8,
    BIRCH_LOG: 9,
    BIRCH_LEAVES: 10,
    SPRUCE_LOG: 11,
    SPRUCE_LEAVES: 12
  };

  /**
   * Generates deterministic tree locations across 48x48 spawn area based on seed and biome
   */
  function getBiomeTrees(seed, terrain, biomeGen, isFlat = false) {
    if (isFlat || !terrain) return [];

    const s = typeof seed === 'bigint' ? seed : BigInt(seed);
    const JavaRandomClass = root.JavaRandom || (typeof require !== 'undefined' ? require('./noise.js').JavaRandom : null);
    if (!JavaRandomClass) {
      throw new Error('JavaRandom class not found. Ensure noise.js is loaded first.');
    }

    const rnd = new JavaRandomClass(s + 55555n);
    const trees = [];
    const minDistanceSq = 4 * 4; // Minimum 4 blocks between trees

    // 8x8 grid cells across 48x48 spawn area (6x6 cells)
    for (let gridZ = 0; gridZ < 6; gridZ++) {
      for (let gridX = 0; gridX < 6; gridX++) {
        const tx = gridX * 8 + 2 + rnd.nextInt(4);
        const tz = gridZ * 8 + 2 + rnd.nextInt(4);

        // Keep player spawn point clear (Chunk 0,0 center at X=8, Z=8)
        if (Math.abs(tx - 8) <= 2 && Math.abs(tz - 8) <= 2) continue;

        const groundY = terrain.getHeight(tx, tz);
        if (groundY < 63) continue; // No trees underwater

        const biomeId = biomeGen ? biomeGen.getBiomeAt(tx, tz, groundY) : 1;

        // Biome rules:
        // Desert (2) and Beach (16) have NO trees
        if (biomeId === 2 || biomeId === 16) continue;

        // Determine spawn probability per biome
        let spawnChance = 45; // Default Plains chance
        if (biomeId === 4 || biomeId === 27) spawnChance = 85; // Dense Forest
        if (biomeId === 5) spawnChance = 65; // Taiga
        if (biomeId === 3) spawnChance = 25; // Mountains (sparse)

        if (rnd.nextInt(100) > spawnChance) continue;

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

        // Determine tree species based on biome
        let species = 'oak';
        if (biomeId === 4) {
          // Forest: 60% Birch, 40% Oak
          species = rnd.nextInt(100) < 60 ? 'birch' : 'oak';
        } else if (biomeId === 27) {
          // Birch Forest: 90% Birch
          species = rnd.nextInt(100) < 90 ? 'birch' : 'oak';
        } else if (biomeId === 5 || (biomeId === 3 && groundY >= 68)) {
          // Taiga / high mountain: Spruce pine
          species = 'spruce';
        } else {
          // Plains: 80% Oak, 20% Birch
          species = rnd.nextInt(100) < 20 ? 'birch' : 'oak';
        }

        let trunkHeight = 4;
        let logId = TREE_BLOCKS.OAK_LOG;
        let leavesId = TREE_BLOCKS.OAK_LEAVES;

        if (species === 'birch') {
          trunkHeight = 5 + rnd.nextInt(2); // Birch is taller (5-6 blocks)
          logId = TREE_BLOCKS.BIRCH_LOG;
          leavesId = TREE_BLOCKS.BIRCH_LEAVES;
        } else if (species === 'spruce') {
          trunkHeight = 6 + rnd.nextInt(2); // Spruce is 6-7 blocks
          logId = TREE_BLOCKS.SPRUCE_LOG;
          leavesId = TREE_BLOCKS.SPRUCE_LEAVES;
        } else {
          trunkHeight = (groundY >= 71) ? 4 : (4 + rnd.nextInt(2));
          logId = TREE_BLOCKS.OAK_LOG;
          leavesId = TREE_BLOCKS.OAK_LEAVES;
        }

        // Clamp height so top canopy stays strictly within Section 4 (Y <= 79)
        if (groundY + trunkHeight + 2 > 79) {
          trunkHeight = Math.max(3, 77 - groundY);
        }

        trees.push({
          x: tx,
          z: tz,
          y: groundY,
          species: species,
          trunkHeight: trunkHeight,
          logId: logId,
          leavesId: leavesId
        });
      }
    }

    return trees;
  }

  /**
   * Helper to stamp any tree into a target block setter callback
   */
  function stampTree(tree, stampBlock) {
    const top = tree.y + tree.trunkHeight;

    // 1. Trunk
    for (let ty = tree.y + 1; ty <= top; ty++) {
      stampBlock(tree.x, ty, tree.z, tree.logId);
    }

    // 2. Foliage based on species
    if (tree.species === 'spruce') {
      // Conical Pine Foliage: alternating layers
      // Peak leaf
      stampBlock(tree.x, top + 1, tree.z, tree.leavesId);

      // Top cross
      const cross = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of cross) {
        stampBlock(tree.x + dx, top, tree.z + dz, tree.leavesId);
      }

      // Middle ring (3x3 corners off)
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
          stampBlock(tree.x + dx, top - 1, tree.z + dz, tree.leavesId);
        }
      }

      // Bottom wider ring (5x5 corners off)
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (Math.abs(dx) === 2 && Math.abs(dz) === 1) continue;
          if (Math.abs(dx) === 1 && Math.abs(dz) === 2) continue;
          stampBlock(tree.x + dx, top - 2, tree.z + dz, tree.leavesId);
        }
      }
    } else if (tree.species === 'birch') {
      // Birch Canopy: slender oval (3x3 layers with top plus)
      for (let ly = top - 1; ly <= top; ly++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
            stampBlock(tree.x + dx, ly, tree.z + dz, tree.leavesId);
          }
        }
      }
      // Top plus
      const cross = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of cross) {
        stampBlock(tree.x + dx, top + 1, tree.z + dz, tree.leavesId);
      }
    } else {
      // Classic Oak Tree Canopy
      for (let ly = top - 1; ly <= top; ly++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
            stampBlock(tree.x + dx, ly, tree.z + dz, tree.leavesId);
          }
        }
      }
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
          stampBlock(tree.x + dx, top + 1, tree.z + dz, tree.leavesId);
        }
      }
      const plusOffsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of plusOffsets) {
        stampBlock(tree.x + dx, top + 2, tree.z + dz, tree.leavesId);
      }
    }
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TREE_BLOCKS, getBiomeTrees, stampTree };
  } else {
    root.TREE_BLOCKS = TREE_BLOCKS;
    root.getBiomeTrees = getBiomeTrees;
    root.stampTree = stampTree;
  }
})(typeof window !== 'undefined' ? window : globalThis);
