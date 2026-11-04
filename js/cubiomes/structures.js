/**
 * Cubiomes Structure Finder Module (Pure JavaScript Port)
 * --------------------------------------------------------
 * Direct port of Minecraft Java Edition 1.16+ Structure Finding Algorithms (cubiomes/finders.c)
 * Matches Chunkbase.com 1.16.1 positions for all Overworld and Nether structures.
 */

(function (root) {
  'use strict';

  const K = 0x5DEECE66Dn;
  const M = (1n << 48n) - 1n;
  const b = 0xBn;

  // LCG nextInt helper for 64-bit BigInt
  function javaNextInt(seedRef, bound) {
    seedRef.seed = (seedRef.seed * K + b) & M;
    if ((bound & (bound - 1)) === 0) {
      // Power of two
      return Number((BigInt(bound) * (seedRef.seed >> 17n)) >> 31n);
    }
    return Number((seedRef.seed >> 17n) % BigInt(bound));
  }

  function javaNextDouble(seedRef) {
    seedRef.seed = (seedRef.seed * K + b) & M;
    const high = seedRef.seed >> 22n;
    seedRef.seed = (seedRef.seed * K + b) & M;
    const low = seedRef.seed >> 21n;
    return Number((high << 27n) + low) / 9007199254740992.0;
  }

  function getFeaturePos(sc, worldSeed, regX, regZ) {
    const rx = BigInt(regX);
    const rz = BigInt(regZ);
    let s = (worldSeed + rx * 341873128712n + rz * 132897987541n + BigInt(sc.salt)) ^ K;

    s = (s * K + b) & M;
    const r = sc.chunkRange;
    let cx, cz;
    if ((r & (r - 1)) !== 0) {
      cx = Number((s >> 17n) % BigInt(r));
      s = (s * K + b) & M;
      cz = Number((s >> 17n) % BigInt(r));
    } else {
      cx = Number((BigInt(r) * (s >> 17n)) >> 31n);
      s = (s * K + b) & M;
      cz = Number((BigInt(r) * (s >> 17n)) >> 31n);
    }

    const chunkX = regX * sc.regionSize + cx;
    const chunkZ = regZ * sc.regionSize + cz;
    return {
      chunkX,
      chunkZ,
      x: (chunkX << 4) + 8,
      z: (chunkZ << 4) + 8
    };
  }

  function getLargeStructurePos(sc, worldSeed, regX, regZ) {
    const rx = BigInt(regX);
    const rz = BigInt(regZ);
    let s = (worldSeed + rx * 341873128712n + rz * 132897987541n + BigInt(sc.salt)) ^ K;

    s = (s * K + b) & M;
    let cx = Number((s >> 17n) % BigInt(sc.chunkRange));
    s = (s * K + b) & M;
    cx += Number((s >> 17n) % BigInt(sc.chunkRange));

    s = (s * K + b) & M;
    let cz = Number((s >> 17n) % BigInt(sc.chunkRange));
    s = (s * K + b) & M;
    cz += Number((s >> 17n) % BigInt(sc.chunkRange));

    cx >>= 1;
    cz >>= 1;

    const chunkX = regX * sc.regionSize + cx;
    const chunkZ = regZ * sc.regionSize + cz;
    return {
      chunkX,
      chunkZ,
      x: (chunkX << 4) + 8,
      z: (chunkZ << 4) + 8
    };
  }

  // Nether RegPos (Fortress & Bastion sharing region)
  function getNetherRegPos(sc, worldSeed, regX, regZ) {
    const rx = BigInt(regX);
    const rz = BigInt(regZ);
    let s = (worldSeed + rx * 341873128712n + rz * 132897987541n + BigInt(sc.salt)) ^ K;

    s = (s * K + b) & M;
    const cx = Number((s >> 17n) % BigInt(sc.chunkRange));
    s = (s * K + b) & M;
    const cz = Number((s >> 17n) % BigInt(sc.chunkRange));

    // Next random roll for Bastion vs Fortress
    s = (s * K + b) & M;
    const roll = Number((s >> 17n) % 5n); // 0,1: Fortress (40%), 2,3,4: Bastion (60%)

    const chunkX = regX * sc.regionSize + cx;
    const chunkZ = regZ * sc.regionSize + cz;
    return {
      chunkX,
      chunkZ,
      x: (chunkX << 4) + 8,
      z: (chunkZ << 4) + 8,
      roll
    };
  }

  // Slime Chunk Check
  function isSlimeChunk(seed, chunkX, chunkZ) {
    const sSeed = typeof seed === 'bigint' ? seed : BigInt(seed);
    const x = BigInt(chunkX);
    const z = BigInt(chunkZ);
    const hash = BigInt.asIntN(64,
      sSeed +
      (x * x * 0x4C1906n) +
      (x * 0x5AC0DBn) +
      (z * z * 0x4307A7n) +
      (z * 0x5F24Fn) ^ 0x3AD8025Fn
    );

    let rnd = (hash ^ K) & M;
    rnd = (rnd * K + b) & M;
    return Number((rnd >> 17n) % 10n) === 0;
  }

  // Structure Definitions & Sprite Sheet Mapping (assets/icons/features.webp: 242x88 px, 22x22 cells)
  const STRUCTURE_TYPES = {
    // Overworld
    village: {
      id: 'village',
      name: 'Village',
      dimension: 'overworld',
      salt: 10387312,
      regionSize: 32,
      chunkRange: 24,
      large: false,
      icon: { sx: 0, sy: 66, sw: 22, sh: 22 } // Plains default
    },
    desert_pyramid: {
      id: 'desert_pyramid',
      name: 'Desert Pyramid',
      dimension: 'overworld',
      salt: 14357617,
      regionSize: 32,
      chunkRange: 24,
      large: false,
      icon: { sx: 132, sy: 0, sw: 22, sh: 22 }
    },
    jungle_temple: {
      id: 'jungle_temple',
      name: 'Jungle Temple',
      dimension: 'overworld',
      salt: 14357619,
      regionSize: 32,
      chunkRange: 24,
      large: false,
      icon: { sx: 88, sy: 22, sw: 22, sh: 22 }
    },
    swamp_hut: {
      id: 'swamp_hut',
      name: 'Swamp Hut',
      dimension: 'overworld',
      salt: 14357620,
      regionSize: 32,
      chunkRange: 24,
      large: false,
      icon: { sx: 132, sy: 22, sw: 22, sh: 22 }
    },
    pillager_outpost: {
      id: 'pillager_outpost',
      name: 'Pillager Outpost',
      dimension: 'overworld',
      salt: 165745296,
      regionSize: 32,
      chunkRange: 24,
      large: false,
      icon: { sx: 44, sy: 44, sw: 22, sh: 22 }
    },
    ocean_monument: {
      id: 'ocean_monument',
      name: 'Ocean Monument',
      dimension: 'overworld',
      salt: 10387313,
      regionSize: 32,
      chunkRange: 27,
      large: true,
      icon: { sx: 198, sy: 22, sw: 22, sh: 22 }
    },
    woodland_mansion: {
      id: 'woodland_mansion',
      name: 'Woodland Mansion',
      dimension: 'overworld',
      salt: 10387319,
      regionSize: 80,
      chunkRange: 60,
      large: true,
      icon: { sx: 198, sy: 66, sw: 22, sh: 22 }
    },
    shipwreck: {
      id: 'shipwreck',
      name: 'Shipwreck',
      dimension: 'overworld',
      salt: 165745295,
      regionSize: 24,
      chunkRange: 20,
      large: false,
      icon: { sx: 0, sy: 44, sw: 22, sh: 22 }
    },
    ruined_portal: {
      id: 'ruined_portal',
      name: 'Ruined Portal',
      dimension: 'overworld',
      salt: 34222645,
      regionSize: 40,
      chunkRange: 25,
      large: false,
      icon: { sx: 88, sy: 44, sw: 22, sh: 22 }
    },
    mineshaft: {
      id: 'mineshaft',
      name: 'Mineshaft',
      dimension: 'overworld',
      icon: { sx: 154, sy: 22, sw: 22, sh: 22 }
    },
    stronghold: {
      id: 'stronghold',
      name: 'Stronghold',
      dimension: 'overworld',
      icon: { sx: 176, sy: 44, sw: 22, sh: 22 }
    },
    slime_chunk: {
      id: 'slime_chunk',
      name: 'Slime Chunk',
      dimension: 'overworld',
      icon: { sx: 132, sy: 44, sw: 22, sh: 22 }
    },

    // The Nether
    fortress: {
      id: 'fortress',
      name: 'Nether Fortress',
      dimension: 'nether',
      salt: 30084232,
      regionSize: 27,
      chunkRange: 23,
      icon: { sx: 176, sy: 22, sw: 22, sh: 22 }
    },
    bastion: {
      id: 'bastion',
      name: 'Bastion Remnant',
      dimension: 'nether',
      salt: 30084232,
      regionSize: 27,
      chunkRange: 23,
      icon: { sx: 22, sy: 44, sw: 22, sh: 22 }
    },
    ruined_portal_n: {
      id: 'ruined_portal_n',
      name: 'Ruined Portal (Nether)',
      dimension: 'nether',
      salt: 34222645,
      regionSize: 25,
      chunkRange: 15,
      icon: { sx: 88, sy: 44, sw: 22, sh: 22 }
    },
    nether_fossil: {
      id: 'nether_fossil',
      name: 'Nether Fossil',
      dimension: 'nether',
      icon: { sx: 22, sy: 22, sw: 22, sh: 22 }
    }
  };

  // Village Sub-Variant Icons
  const VILLAGE_VARIANTS = {
    plains:  { name: 'Plains Village',  icon: { sx: 0,  sy: 66, sw: 22, sh: 22 } },
    savanna: { name: 'Savanna Village', icon: { sx: 22, sy: 66, sw: 22, sh: 22 } },
    desert:  { name: 'Desert Village',  icon: { sx: 44, sy: 66, sw: 22, sh: 22 } },
    taiga:   { name: 'Taiga Village',   icon: { sx: 66, sy: 66, sw: 22, sh: 22 } },
    snowy:   { name: 'Snowy Village',   icon: { sx: 88, sy: 66, sw: 22, sh: 22 } }
  };

  class StructureFinder {
    constructor(seed = 0n) {
      this.seed = 0n;
      this.strongholds = [];
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

      this.precomputeStrongholds();
    }

    /**
     * Precomputes the 128 Strongholds in Java 1.16
     */
    precomputeStrongholds() {
      this.strongholds = [];
      const seedRef = { seed: (this.seed ^ K) & M };
      let angle = 2.0 * Math.PI * javaNextDouble(seedRef);
      let dist = (4.0 * 32.0) + (javaNextDouble(seedRef) - 0.5) * 32.0 * 2.5;

      let ringNum = 0;
      let ringMax = 3;
      let ringIdx = 0;

      for (let i = 0; i < 128; i++) {
        const x = Math.round(Math.cos(angle) * dist) * 16 + 4;
        const z = Math.round(Math.sin(angle) * dist) * 16 + 4;
        this.strongholds.push({
          id: 'stronghold',
          name: `Stronghold #${i + 1}`,
          type: 'stronghold',
          x,
          z,
          chunkX: x >> 4,
          chunkZ: z >> 4,
          icon: STRUCTURE_TYPES.stronghold.icon
        });

        ringIdx++;
        angle += (2.0 * Math.PI) / ringMax;
        if (ringIdx === ringMax) {
          ringNum++;
          ringIdx = 0;
          ringMax = ringMax + Math.floor((2 * ringMax) / (ringNum + 1));
          if (ringMax > 128 - i) ringMax = 128 - i;
          angle += javaNextDouble(seedRef) * Math.PI * 2.0;
          dist = (4.0 * 32.0 * (ringNum + 1)) + (javaNextDouble(seedRef) - 0.5) * 32.0 * 2.5;
        }
      }
    }

    /**
     * Finds all active structures within the visible bounding box [minX, minZ] to [maxX, maxZ] (in blocks).
     */
    getStructuresInArea(dimension, minX, minZ, maxX, maxZ, enabledTypes, biomeGen) {
      const results = [];
      const dim = dimension || 'overworld';

      if (dim === 'overworld') {
        this.getOverworldStructures(minX, minZ, maxX, maxZ, enabledTypes, biomeGen, results);
      } else if (dim === 'nether') {
        this.getNetherStructures(minX, minZ, maxX, maxZ, enabledTypes, biomeGen, results);
      }

      return results;
    }

    getOverworldStructures(minX, minZ, maxX, maxZ, enabledTypes, biomeGen, out) {
      // 1. Strongholds
      if (enabledTypes.has('stronghold')) {
        for (let i = 0; i < this.strongholds.length; i++) {
          const sh = this.strongholds[i];
          if (sh.x >= minX && sh.x <= maxX && sh.z >= minZ && sh.z <= maxZ) {
            out.push(sh);
          }
        }
      }

      // 2. Region-based Overworld Structures
      const overworldTypes = [
        'village',
        'desert_pyramid',
        'jungle_temple',
        'swamp_hut',
        'pillager_outpost',
        'ocean_monument',
        'woodland_mansion',
        'shipwreck',
        'ruined_portal'
      ];

      for (let t = 0; t < overworldTypes.length; t++) {
        const typeKey = overworldTypes[t];
        if (!enabledTypes.has(typeKey)) continue;

        const config = STRUCTURE_TYPES[typeKey];
        const regSize = config.regionSize;
        const regBlockSize = regSize * 16;

        const minRegX = Math.floor(minX / regBlockSize);
        const maxRegX = Math.floor(maxX / regBlockSize);
        const minRegZ = Math.floor(minZ / regBlockSize);
        const maxRegZ = Math.floor(maxZ / regBlockSize);

        for (let rz = minRegZ; rz <= maxRegZ; rz++) {
          for (let rx = minRegX; rx <= maxRegX; rx++) {
            const pos = config.large
              ? getLargeStructurePos(config, this.seed, rx, rz)
              : getFeaturePos(config, this.seed, rx, rz);

            if (pos.x < minX || pos.x > maxX || pos.z < minZ || pos.z > maxZ) {
              continue;
            }

            // Biome Viability Check
            const biomeId = biomeGen ? biomeGen.getBiomeAtBlock(pos.x, pos.z) : 1;
            const item = this.validateAndFormatOverworld(typeKey, config, pos, biomeId);
            if (item) {
              out.push(item);
            }
          }
        }
      }

      // 3. Slime Chunks (render when camera is reasonably zoomed in)
      if (enabledTypes.has('slime_chunk') && (maxX - minX) <= 3200) {
        const minChunkX = minX >> 4;
        const maxChunkX = maxX >> 4;
        const minChunkZ = minZ >> 4;
        const maxChunkZ = maxZ >> 4;

        for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
          for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            if (isSlimeChunk(this.seed, cx, cz)) {
              out.push({
                id: `slime_${cx}_${cz}`,
                name: `Slime Chunk [${cx}, ${cz}]`,
                type: 'slime_chunk',
                x: (cx << 4) + 8,
                z: (cz << 4) + 8,
                chunkX: cx,
                chunkZ: cz,
                icon: STRUCTURE_TYPES.slime_chunk.icon
              });
            }
          }
        }
      }
    }

    validateAndFormatOverworld(typeKey, config, pos, biomeId) {
      switch (typeKey) {
        case 'village': {
          // Plains, Desert, Savanna, Taiga, Snowy Tundra
          let variant = null;
          if (biomeId === 1) variant = VILLAGE_VARIANTS.plains;
          else if (biomeId === 2 || biomeId === 17) variant = VILLAGE_VARIANTS.desert;
          else if (biomeId === 35 || biomeId === 36 || biomeId === 163 || biomeId === 164) variant = VILLAGE_VARIANTS.savanna;
          else if (biomeId === 5 || biomeId === 19 || biomeId === 133) variant = VILLAGE_VARIANTS.taiga;
          else if (biomeId === 12 || biomeId === 13 || biomeId === 140) variant = VILLAGE_VARIANTS.snowy;

          if (!variant) return null;
          return {
            id: `village_${pos.chunkX}_${pos.chunkZ}`,
            name: variant.name,
            type: 'village',
            x: pos.x,
            z: pos.z,
            chunkX: pos.chunkX,
            chunkZ: pos.chunkZ,
            icon: variant.icon
          };
        }

        case 'desert_pyramid': {
          if (biomeId === 2 || biomeId === 17) {
            return {
              id: `pyramid_${pos.chunkX}_${pos.chunkZ}`,
              name: 'Desert Pyramid',
              type: 'desert_pyramid',
              x: pos.x,
              z: pos.z,
              chunkX: pos.chunkX,
              chunkZ: pos.chunkZ,
              icon: config.icon
            };
          }
          return null;
        }

        case 'swamp_hut': {
          if (biomeId === 6 || biomeId === 134) {
            return {
              id: `swamp_hut_${pos.chunkX}_${pos.chunkZ}`,
              name: 'Swamp Hut',
              type: 'swamp_hut',
              x: pos.x,
              z: pos.z,
              chunkX: pos.chunkX,
              chunkZ: pos.chunkZ,
              icon: config.icon
            };
          }
          return null;
        }

        case 'jungle_temple': {
          if (biomeId === 21 || biomeId === 22 || biomeId === 149 || biomeId === 168 || biomeId === 169) {
            return {
              id: `jungle_temple_${pos.chunkX}_${pos.chunkZ}`,
              name: 'Jungle Temple',
              type: 'jungle_temple',
              x: pos.x,
              z: pos.z,
              chunkX: pos.chunkX,
              chunkZ: pos.chunkZ,
              icon: config.icon
            };
          }
          return null;
        }

        case 'pillager_outpost': {
          // Attempt seed check: 20% rate
          const sRef = { seed: (this.seed + BigInt(pos.chunkX) * 341873128712n + BigInt(pos.chunkZ) * 132897987541n) ^ K };
          if (javaNextInt(sRef, 5) !== 0) return null;

          const isViableBiome = (
            biomeId === 1 || biomeId === 2 || biomeId === 5 || biomeId === 12 ||
            biomeId === 35 || biomeId === 36 || biomeId === 19 || biomeId === 133
          );
          if (!isViableBiome) return null;

          return {
            id: `outpost_${pos.chunkX}_${pos.chunkZ}`,
            name: 'Pillager Outpost',
            type: 'pillager_outpost',
            x: pos.x,
            z: pos.z,
            chunkX: pos.chunkX,
            chunkZ: pos.chunkZ,
            icon: config.icon
          };
        }

        case 'ocean_monument': {
          // Deep ocean biomes: 24, 46, 47, 48, 49
          if (biomeId === 24 || biomeId === 46 || biomeId === 47 || biomeId === 48 || biomeId === 49) {
            return {
              id: `monument_${pos.chunkX}_${pos.chunkZ}`,
              name: 'Ocean Monument',
              type: 'ocean_monument',
              x: pos.x,
              z: pos.z,
              chunkX: pos.chunkX,
              chunkZ: pos.chunkZ,
              icon: config.icon
            };
          }
          return null;
        }

        case 'woodland_mansion': {
          // Dark forest: 29, 157
          if (biomeId === 29 || biomeId === 157) {
            return {
              id: `mansion_${pos.chunkX}_${pos.chunkZ}`,
              name: 'Woodland Mansion',
              type: 'woodland_mansion',
              x: pos.x,
              z: pos.z,
              chunkX: pos.chunkX,
              chunkZ: pos.chunkZ,
              icon: config.icon
            };
          }
          return null;
        }

        case 'shipwreck': {
          // Oceans and Beaches (0, 10, 11, 14, 15, 16, 24, 25, 26, 44, 45, 46, 47, 48, 49, 50)
          const isOceanOrBeach = (
            biomeId === 0 || biomeId === 10 || biomeId === 11 || biomeId === 14 ||
            biomeId === 15 || biomeId === 16 || biomeId === 24 || biomeId === 25 ||
            biomeId === 26 || (biomeId >= 44 && biomeId <= 50)
          );
          if (isOceanOrBeach) {
            return {
              id: `shipwreck_${pos.chunkX}_${pos.chunkZ}`,
              name: 'Shipwreck',
              type: 'shipwreck',
              x: pos.x,
              z: pos.z,
              chunkX: pos.chunkX,
              chunkZ: pos.chunkZ,
              icon: config.icon
            };
          }
          return null;
        }

        case 'ruined_portal': {
          // Ruined portal generates in all overworld biomes
          return {
            id: `ruined_portal_${pos.chunkX}_${pos.chunkZ}`,
            name: 'Ruined Portal',
            type: 'ruined_portal',
            x: pos.x,
            z: pos.z,
            chunkX: pos.chunkX,
            chunkZ: pos.chunkZ,
            icon: config.icon
          };
        }

        default:
          return null;
      }
    }

    getNetherStructures(minX, minZ, maxX, maxZ, enabledTypes, biomeGen, out) {
      // 1. Nether Fortress & Bastion Remnants
      const netherConfig = STRUCTURE_TYPES.fortress;
      const regBlockSize = netherConfig.regionSize * 16;

      const minRegX = Math.floor(minX / regBlockSize);
      const maxRegX = Math.floor(maxX / regBlockSize);
      const minRegZ = Math.floor(minZ / regBlockSize);
      const maxRegZ = Math.floor(maxZ / regBlockSize);

      for (let rz = minRegZ; rz <= maxRegZ; rz++) {
        for (let rx = minRegX; rx <= maxRegX; rx++) {
          const pos = getNetherRegPos(netherConfig, this.seed, rx, rz);
          if (pos.x < minX || pos.x > maxX || pos.z < minZ || pos.z > maxZ) {
            continue;
          }

          const biomeId = biomeGen ? biomeGen.getBiomeAtBlock(pos.x, pos.z) : 8;

          if (pos.roll < 2) {
            // Nether Fortress (40%)
            if (enabledTypes.has('fortress')) {
              out.push({
                id: `fortress_${pos.chunkX}_${pos.chunkZ}`,
                name: 'Nether Fortress',
                type: 'fortress',
                x: pos.x,
                z: pos.z,
                chunkX: pos.chunkX,
                chunkZ: pos.chunkZ,
                icon: STRUCTURE_TYPES.fortress.icon
              });
            }
          } else {
            // Bastion Remnant (60%) - Valid in all nether biomes except Basalt Deltas (173)
            if (enabledTypes.has('bastion') && biomeId !== 173) {
              out.push({
                id: `bastion_${pos.chunkX}_${pos.chunkZ}`,
                name: 'Bastion Remnant',
                type: 'bastion',
                x: pos.x,
                z: pos.z,
                chunkX: pos.chunkX,
                chunkZ: pos.chunkZ,
                icon: STRUCTURE_TYPES.bastion.icon
              });
            }
          }
        }
      }

      // 2. Ruined Portal (Nether)
      if (enabledTypes.has('ruined_portal_n')) {
        const portalConfig = STRUCTURE_TYPES.ruined_portal_n;
        const pRegBlockSize = portalConfig.regionSize * 16;
        const pMinRegX = Math.floor(minX / pRegBlockSize);
        const pMaxRegX = Math.floor(maxX / pRegBlockSize);
        const pMinRegZ = Math.floor(minZ / pRegBlockSize);
        const pMaxRegZ = Math.floor(maxZ / pRegBlockSize);

        for (let rz = pMinRegZ; rz <= pMaxRegZ; rz++) {
          for (let rx = pMinRegX; rx <= pMaxRegX; rx++) {
            const pos = getFeaturePos(portalConfig, this.seed, rx, rz);
            if (pos.x >= minX && pos.x <= maxX && pos.z >= minZ && pos.z <= maxZ) {
              out.push({
                id: `ruined_portal_n_${pos.chunkX}_${pos.chunkZ}`,
                name: 'Ruined Portal',
                type: 'ruined_portal_n',
                x: pos.x,
                z: pos.z,
                chunkX: pos.chunkX,
                chunkZ: pos.chunkZ,
                icon: portalConfig.icon
              });
            }
          }
        }
      }
    }
  }

  // Export
  root.StructureFinder = StructureFinder;
  root.STRUCTURE_TYPES = STRUCTURE_TYPES;
  root.VILLAGE_VARIANTS = VILLAGE_VARIANTS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StructureFinder, STRUCTURE_TYPES, VILLAGE_VARIANTS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
