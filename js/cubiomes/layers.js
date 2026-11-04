/**
 * Cubiomes Layers Module (Pure JavaScript Port)
 * --------------------------------------------
 * Direct port of cubiomes/layers.h and cubiomes/layers.c
 * Target: Minecraft Java Edition 1.16.1 GenLayer Pipeline
 */

(function (root) {
  'use strict';

  const { BiomeID, isOceanic, isShallowOcean, isDeepOcean, isMesa, isSnowy, areSimilar, getMutated } = root.CubiomesBiomes || (typeof require !== 'undefined' ? require('./biomes.js') : {});
  const { mcStepSeed, mcFirstInt, mcFirstIsZero, getChunkSeed, getLayerSalt, getStartSalt, getStartSeed } = root.CubiomesNoise || (typeof require !== 'undefined' ? require('./noise.js') : {});

  // Biome Category Constants (from cubiomes/layers.h)
  const Oceanic = 0;
  const Warm = 1;
  const Lush = 2;
  const Cold = 3;
  const Freezing = 4;

  const warmBiomes = [BiomeID.desert, BiomeID.desert, BiomeID.desert, BiomeID.savanna, BiomeID.savanna, BiomeID.plains];
  const lushBiomes = [BiomeID.forest, BiomeID.dark_forest, BiomeID.mountains, BiomeID.plains, BiomeID.birch_forest, BiomeID.swamp];
  const coldBiomes = [BiomeID.forest, BiomeID.mountains, BiomeID.taiga, BiomeID.plains];
  const snowBiomes = [BiomeID.snowy_tundra, BiomeID.snowy_tundra, BiomeID.snowy_tundra, BiomeID.snowy_taiga];

  function isAny4(id, a, b, c, d) {
    return id === a || id === b || id === c || id === d;
  }

  function isAny4Oceanic(a, b, c, d) {
    return isOceanic(a) || isOceanic(b) || isOceanic(c) || isOceanic(d);
  }

  function select4(cs, st, v00, v01, v10, v11) {
    const cv00 = (v00 === v10) + (v00 === v01) + (v00 === v11);
    const cv10 = (v10 === v01) + (v10 === v11);
    const cv01 = (v01 === v11);

    if (cv00 > cv10 && cv00 > cv01) return v00;
    if (cv10 > cv00) return v10;
    if (cv01 > cv00) return v01;

    let c = Math.imul(cs, Math.imul(cs, 1284865837) + 4150755663) | 0;
    c = (c + st) | 0;
    const r = (c >>> 24) & 3;
    return r === 0 ? v00 : r === 1 ? v10 : r === 2 ? v01 : v11;
  }

  function replaceEdge(out, idx, v10, v21, v01, v12, id, baseID, edgeID) {
    if (id !== baseID) return false;
    if (areSimilar(v10, baseID) && areSimilar(v21, baseID) && areSimilar(v01, baseID) && areSimilar(v12, baseID)) {
      out[idx] = id;
    } else {
      out[idx] = edgeID;
    }
    return true;
  }

  /**
   * Base Layer Class
   */
  class Layer {
    constructor(salt, p = null, p2 = null) {
      this.salt = BigInt(salt);
      this.layerSalt = getLayerSalt(this.salt);
      this.startSalt = 0n;
      this.startSeed = 0n;
      this.p = p;
      this.p2 = p2;
      this.noise = null;
    }

    setWorldSeed(worldSeed) {
      const ws = typeof worldSeed === 'bigint' ? worldSeed : BigInt(worldSeed);
      if (this.p) this.p.setWorldSeed(ws);
      if (this.p2) this.p2.setWorldSeed(ws);

      if (this.salt === 0n) {
        this.startSalt = 0n;
        this.startSeed = 0n;
      } else {
        this.startSalt = getStartSalt(ws, this.layerSalt);
        this.startSeed = getStartSeed(ws, this.layerSalt);
      }
    }

    getMap(x, z, w, h) {
      throw new Error('getMap() must be implemented by subclass');
    }
  }

  // --- Layer Implementations ---

  class ContinentLayer extends Layer {
    getMap(x, z, w, h) {
      const out = new Int32Array(w * h);
      const ss = this.startSeed;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const cs = getChunkSeed(ss, i + x, j + z);
          out[j * w + i] = mcFirstIsZero(cs, 10) ? 1 : 0;
        }
      }
      if (x > -w && x <= 0 && z > -h && z <= 0) {
        out[-z * w - x] = 1;
      }
      return out;
    }
  }

  class ZoomLayer extends Layer {
    constructor(salt, p = null, isFuzzy = false) {
      let parent = p;
      let fuzzy = isFuzzy;
      if (typeof p === 'boolean' && isFuzzy instanceof Layer) {
        fuzzy = p;
        parent = isFuzzy;
      }
      super(salt, parent);
      this.isFuzzy = Boolean(fuzzy);
    }

    getMap(x, z, w, h) {
      const pX = x >> 1;
      const pZ = z >> 1;
      const pW = ((x + w) >> 1) - pX + 1;
      const pH = ((z + h) >> 1) - pZ + 1;

      const parentMap = this.p.getMap(pX, pZ, pW, pH);
      const newW = pW * 2;
      const buf = new Int32Array(newW * pH * 2);

      const st = Number(BigInt.asIntN(32, this.startSalt));
      const ss = Number(BigInt.asIntN(32, this.startSeed));

      for (let j = 0; j < pH; j++) {
        let idx = (j * 2) * newW;
        let v00 = parentMap[j * pW];
        let v01 = parentMap[(j + 1) * pW];

        for (let i = 0; i < pW; i++) {
          const v10 = parentMap[i + 1 + j * pW];
          const v11 = parentMap[i + 1 + (j + 1) * pW];

          if (v00 === v01 && v00 === v10 && v00 === v11) {
            buf[idx] = v00;
            buf[idx + 1] = v00;
            buf[idx + newW] = v00;
            buf[idx + newW + 1] = v00;
            idx += 2;
            v00 = v10;
            v01 = v11;
            continue;
          }

          const chunkX = (i + pX) * 2;
          const chunkZ = (j + pZ) * 2;

          let cs = (ss + chunkX) | 0;
          cs = (Math.imul(cs, Math.imul(cs, 1284865837) + 4150755663) + chunkZ) | 0;
          cs = (Math.imul(cs, Math.imul(cs, 1284865837) + 4150755663) + chunkX) | 0;
          cs = (Math.imul(cs, Math.imul(cs, 1284865837) + 4150755663) + chunkZ) | 0;

          buf[idx] = v00;
          buf[idx + newW] = (cs >>> 24) & 1 ? v01 : v00;
          idx++;

          cs = (Math.imul(cs, Math.imul(cs, 1284865837) + 4150755663) + st) | 0;
          buf[idx] = (cs >>> 24) & 1 ? v10 : v00;

          if (this.isFuzzy) {
            cs = (Math.imul(cs, Math.imul(cs, 1284865837) + 4150755663) + st) | 0;
            const r = (cs >>> 24) & 3;
            buf[idx + newW] = r === 0 ? v00 : r === 1 ? v10 : r === 2 ? v01 : v11;
          } else {
            buf[idx + newW] = select4(cs, st, v00, v01, v10, v11);
          }
          idx++;

          v00 = v10;
          v01 = v11;
        }
      }

      const out = new Int32Array(w * h);
      const offX = x & 1;
      const offZ = z & 1;
      for (let j = 0; j < h; j++) {
        const srcStart = (j + offZ) * newW + offX;
        const dstStart = j * w;
        out.set(buf.subarray(srcStart, srcStart + w), dstStart);
      }
      return out;
    }
  }

  class LandLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1;
      const pZ = z - 1;
      const pW = w + 2;
      const pH = h + 2;

      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);

      const st = this.startSalt;
      const ss = this.startSeed;

      for (let j = 0; j < h; j++) {
        let v00 = pMap[j * pW];
        let vt0 = pMap[j * pW + 1];
        let v02 = pMap[(j + 2) * pW];
        let vt2 = pMap[(j + 2) * pW + 1];

        for (let i = 0; i < w; i++) {
          const v11 = pMap[i + 1 + (j + 1) * pW];
          const v20 = pMap[i + 2 + j * pW];
          const v22 = pMap[i + 2 + (j + 2) * pW];
          let v = v11;

          switch (v11) {
            case BiomeID.ocean:
              if (v00 || v20 || v02 || v22) {
                let cs = getChunkSeed(ss, i + x, j + z);
                let inc = 0;
                v = 1;

                if (v00 !== BiomeID.ocean) { inc++; v = v00; cs = mcStepSeed(cs, st); }
                if (v20 !== BiomeID.ocean) { if (++inc === 1 || mcFirstIsZero(cs, 2)) v = v20; cs = mcStepSeed(cs, st); }
                if (v02 !== BiomeID.ocean) {
                  inc++;
                  if (inc === 1) v = v02;
                  else if (inc === 2) { if (mcFirstIsZero(cs, 2)) v = v02; }
                  else { if (mcFirstIsZero(cs, 3)) v = v02; }
                  cs = mcStepSeed(cs, st);
                }
                if (v22 !== BiomeID.ocean) {
                  inc++;
                  if (inc === 1) v = v22;
                  else if (inc === 2) { if (mcFirstIsZero(cs, 2)) v = v22; }
                  else if (inc === 3) { if (mcFirstIsZero(cs, 3)) v = v22; }
                  else { if (mcFirstIsZero(cs, 4)) v = v22; }
                  cs = mcStepSeed(cs, st);
                }

                if (v !== BiomeID.forest) {
                  if (!mcFirstIsZero(cs, 3)) v = BiomeID.ocean;
                }
              }
              break;

            case BiomeID.forest:
              break;

            default:
              if (v00 === 0 || v20 === 0 || v02 === 0 || v22 === 0) {
                const cs = getChunkSeed(ss, i + x, j + z);
                if (mcFirstIsZero(cs, 5)) v = 0;
              }
          }

          out[i + j * w] = v;
          v00 = vt0; vt0 = v20;
          v02 = vt2; vt2 = v22;
        }
      }
      return out;
    }
  }

  class IslandLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);
      const ss = this.startSeed;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const v11 = pMap[i + 1 + (j + 1) * pW];
          out[i + j * w] = v11;
          if (v11 === Oceanic) {
            if (pMap[i + 1 + j * pW] !== Oceanic) continue;
            if (pMap[i + 2 + (j + 1) * pW] !== Oceanic) continue;
            if (pMap[i + (j + 1) * pW] !== Oceanic) continue;
            if (pMap[i + 1 + (j + 2) * pW] !== Oceanic) continue;

            const cs = getChunkSeed(ss, i + x, j + z);
            if (mcFirstIsZero(cs, 2)) out[i + j * w] = 1;
          }
        }
      }
      return out;
    }
  }

  class SnowLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);
      const ss = this.startSeed;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let v11 = pMap[i + 1 + (j + 1) * pW];
          if (!isShallowOcean(v11)) {
            const cs = getChunkSeed(ss, i + x, j + z);
            const r = mcFirstInt(cs, 6);
            if (r === 0) v11 = Freezing;
            else if (r <= 1) v11 = Cold;
            else v11 = Warm;
          }
          out[i + j * w] = v11;
        }
      }
      return out;
    }
  }

  class CoolLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let v11 = pMap[i + 1 + (j + 1) * pW];
          if (v11 === Warm) {
            const v10 = pMap[i + 1 + j * pW];
            const v21 = pMap[i + 2 + (j + 1) * pW];
            const v01 = pMap[i + (j + 1) * pW];
            const v12 = pMap[i + 1 + (j + 2) * pW];
            if (isAny4(Cold, v10, v21, v01, v12) || isAny4(Freezing, v10, v21, v01, v12)) {
              v11 = Lush;
            }
          }
          out[i + j * w] = v11;
        }
      }
      return out;
    }
  }

  class HeatLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let v11 = pMap[i + 1 + (j + 1) * pW];
          if (v11 === Freezing) {
            const v10 = pMap[i + 1 + j * pW];
            const v21 = pMap[i + 2 + (j + 1) * pW];
            const v01 = pMap[i + (j + 1) * pW];
            const v12 = pMap[i + 1 + (j + 2) * pW];
            if (isAny4(Warm, v10, v21, v01, v12) || isAny4(Lush, v10, v21, v01, v12)) {
              v11 = Cold;
            }
          }
          out[i + j * w] = v11;
        }
      }
      return out;
    }
  }

  class SpecialLayer extends Layer {
    getMap(x, z, w, h) {
      const pMap = this.p.getMap(x, z, w, h);
      const out = new Int32Array(pMap);
      const ss = this.startSeed;
      const st = this.startSalt;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let v = out[i + j * w];
          if (v === Oceanic) continue;
          let cs = getChunkSeed(ss, i + x, j + z);
          if (mcFirstIsZero(cs, 13)) {
            cs = mcStepSeed(cs, st);
            v |= ((1 + mcFirstInt(cs, 15)) << 8) & 0xF00;
            out[i + j * w] = v;
          }
        }
      }
      return out;
    }
  }

  class MushroomLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);
      const ss = this.startSeed;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let v11 = pMap[i + 1 + (j + 1) * pW];
          if (v11 === 0 &&
              !pMap[i + j * pW] && !pMap[i + 2 + j * pW] &&
              !pMap[i + (j + 2) * pW] && !pMap[i + 2 + (j + 2) * pW]) {
            const cs = getChunkSeed(ss, i + x, j + z);
            if (mcFirstIsZero(cs, 100)) v11 = BiomeID.mushroom_fields;
          }
          out[i + j * w] = v11;
        }
      }
      return out;
    }
  }

  class DeepOceanLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let v11 = pMap[i + 1 + (j + 1) * pW];
          if (isShallowOcean(v11)) {
            let oceans = 0;
            if (isShallowOcean(pMap[i + 1 + j * pW])) oceans++;
            if (isShallowOcean(pMap[i + 2 + (j + 1) * pW])) oceans++;
            if (isShallowOcean(pMap[i + (j + 1) * pW])) oceans++;
            if (isShallowOcean(pMap[i + 1 + (j + 2) * pW])) oceans++;

            if (oceans >= 4) {
              switch (v11) {
                case BiomeID.warm_ocean: v11 = BiomeID.deep_warm_ocean; break;
                case BiomeID.lukewarm_ocean: v11 = BiomeID.deep_lukewarm_ocean; break;
                case BiomeID.ocean: v11 = BiomeID.deep_ocean; break;
                case BiomeID.cold_ocean: v11 = BiomeID.deep_cold_ocean; break;
                case BiomeID.frozen_ocean: v11 = BiomeID.deep_frozen_ocean; break;
                default: v11 = BiomeID.deep_ocean;
              }
            }
          }
          out[i + j * w] = v11;
        }
      }
      return out;
    }
  }

  class BiomeLayer extends Layer {
    getMap(x, z, w, h) {
      const pMap = this.p.getMap(x, z, w, h);
      const out = new Int32Array(w * h);
      const ss = this.startSeed;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const idx = i + j * w;
          let id = pMap[idx];
          const hasHighBit = (id & 0xF00);
          id &= ~0xF00;

          if (isOceanic(id) || id === BiomeID.mushroom_fields) {
            out[idx] = id;
            continue;
          }

          const cs = getChunkSeed(ss, i + x, j + z);
          let v;
          switch (id) {
            case Warm:
              if (hasHighBit) v = mcFirstIsZero(cs, 3) ? BiomeID.badlands_plateau : BiomeID.wooded_badlands_plateau;
              else v = warmBiomes[mcFirstInt(cs, 6)];
              break;
            case Lush:
              if (hasHighBit) v = BiomeID.jungle;
              else v = lushBiomes[mcFirstInt(cs, 6)];
              break;
            case Cold:
              if (hasHighBit) v = BiomeID.giant_tree_taiga;
              else v = coldBiomes[mcFirstInt(cs, 4)];
              break;
            case Freezing:
              v = snowBiomes[mcFirstInt(cs, 4)];
              break;
            default:
              v = BiomeID.mushroom_fields;
          }
          out[idx] = v;
        }
      }
      return out;
    }
  }

  class BambooLayer extends Layer {
    getMap(x, z, w, h) {
      const pMap = this.p.getMap(x, z, w, h);
      const out = new Int32Array(pMap);
      const ss = this.startSeed;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const idx = i + j * w;
          if (out[idx] === BiomeID.jungle) {
            const cs = getChunkSeed(ss, i + x, j + z);
            if (mcFirstIsZero(cs, 10)) out[idx] = BiomeID.bamboo_jungle;
          }
        }
      }
      return out;
    }
  }

  class BiomeEdgeLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const idx = i + j * w;
          const v11 = pMap[i + 1 + (j + 1) * pW];
          const v10 = pMap[i + 1 + j * pW];
          const v21 = pMap[i + 2 + (j + 1) * pW];
          const v01 = pMap[i + (j + 1) * pW];
          const v12 = pMap[i + 1 + (j + 2) * pW];

          if (!replaceEdge(out, idx, v10, v21, v01, v12, v11, BiomeID.wooded_badlands_plateau, BiomeID.badlands) &&
              !replaceEdge(out, idx, v10, v21, v01, v12, v11, BiomeID.badlands_plateau, BiomeID.badlands) &&
              !replaceEdge(out, idx, v10, v21, v01, v12, v11, BiomeID.giant_tree_taiga, BiomeID.taiga)) {
            if (v11 === BiomeID.desert) {
              out[idx] = isAny4(BiomeID.snowy_tundra, v10, v21, v01, v12) ? BiomeID.wooded_mountains : v11;
            } else if (v11 === BiomeID.swamp) {
              if (!isAny4(BiomeID.desert, v10, v21, v01, v12) &&
                  !isAny4(BiomeID.snowy_taiga, v10, v21, v01, v12) &&
                  !isAny4(BiomeID.snowy_tundra, v10, v21, v01, v12)) {
                out[idx] = (isAny4(BiomeID.jungle, v10, v21, v01, v12) || isAny4(BiomeID.bamboo_jungle, v10, v21, v01, v12)) ? BiomeID.jungle_edge : v11;
              } else {
                out[idx] = BiomeID.plains;
              }
            } else {
              out[idx] = v11;
            }
          }
        }
      }
      return out;
    }
  }

  class NoiseLayer extends Layer {
    getMap(x, z, w, h) {
      const pMap = this.p.getMap(x, z, w, h);
      const out = new Int32Array(pMap);
      const ss = this.startSeed;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const idx = i + j * w;
          if (out[idx] > 0) {
            const cs = getChunkSeed(ss, i + x, j + z);
            out[idx] = mcFirstInt(cs, 299999) + 2;
          }
        }
      }
      return out;
    }
  }

  class HillsLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const bMap = this.p.getMap(pX, pZ, pW, pH);      // parent 1: biome chain
      const rMap = this.p2.getMap(pX, pZ, pW, pH);     // parent 2: river noise
      const out = new Int32Array(w * h);

      const ss = this.startSeed;
      const st = this.startSalt;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const idx = i + 1 + (j + 1) * pW;
          const b11 = bMap[idx];
          const r11 = rMap[idx];

          let cs = getChunkSeed(ss, i + x, j + z);
          const isHill = (r11 >= 2) && ((r11 - 2) % 29 === 0);

          if (b11 > 255) {
            // Already mutated
            out[i + j * w] = b11;
            continue;
          }

          if (isHill) {
            const mutated = getMutated(b11);
            if (mutated !== b11) {
              out[i + j * w] = mutated;
              continue;
            }
          }

          if (mcFirstInt(cs, 3) === 0 || isHill) {
            let hillId = b11;
            switch (b11) {
              case BiomeID.desert: hillId = BiomeID.desert_hills; break;
              case BiomeID.forest: hillId = BiomeID.wooded_hills; break;
              case BiomeID.birch_forest: hillId = BiomeID.birch_forest_hills; break;
              case BiomeID.dark_forest: hillId = BiomeID.plains; break;
              case BiomeID.taiga: hillId = BiomeID.taiga_hills; break;
              case BiomeID.giant_tree_taiga: hillId = BiomeID.giant_tree_taiga_hills; break;
              case BiomeID.snowy_taiga: hillId = BiomeID.snowy_taiga_hills; break;
              case BiomeID.snowy_tundra: hillId = BiomeID.snowy_mountains; break;
              case BiomeID.jungle: hillId = BiomeID.jungle_hills; break;
              case BiomeID.bamboo_jungle: hillId = BiomeID.bamboo_jungle_hills; break;
              case BiomeID.savanna: hillId = BiomeID.savanna_plateau; break;
              case BiomeID.badlands: hillId = BiomeID.wooded_badlands_plateau; break;
              case BiomeID.wooded_badlands_plateau: hillId = BiomeID.badlands; break;
              case BiomeID.deep_ocean:
                cs = mcStepSeed(cs, st);
                hillId = mcFirstIsZero(cs, 3) ? BiomeID.plains : BiomeID.forest;
                break;
              default:
                if (isHill) hillId = getMutated(b11);
            }
            out[i + j * w] = hillId;
          } else {
            out[i + j * w] = b11;
          }
        }
      }
      return out;
    }
  }

  class SunflowerLayer extends Layer {
    getMap(x, z, w, h) {
      const pMap = this.p.getMap(x, z, w, h);
      const out = new Int32Array(pMap);
      const ss = this.startSeed;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const idx = i + j * w;
          if (out[idx] === BiomeID.plains) {
            const cs = getChunkSeed(ss, i + x, j + z);
            if (mcFirstIsZero(cs, 57)) out[idx] = BiomeID.sunflower_plains;
          }
        }
      }
      return out;
    }
  }

  class ShoreLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const idx = i + j * w;
          const v11 = pMap[i + 1 + (j + 1) * pW];
          const v10 = pMap[i + 1 + j * pW];
          const v21 = pMap[i + 2 + (j + 1) * pW];
          const v01 = pMap[i + (j + 1) * pW];
          const v12 = pMap[i + 1 + (j + 2) * pW];

          if (v11 === BiomeID.mushroom_fields) {
            out[idx] = (isAny4(BiomeID.ocean, v10, v21, v01, v12) || isAny4(BiomeID.deep_ocean, v10, v21, v01, v12))
              ? BiomeID.mushroom_field_shore : v11;
          } else if (v11 === BiomeID.jungle || v11 === BiomeID.jungle_edge || v11 === BiomeID.modified_jungle || v11 === BiomeID.modified_jungle_edge) {
            if (isAny4Oceanic(v10, v21, v01, v12)) {
              out[idx] = BiomeID.beach;
            } else if (!isAny4(BiomeID.forest, v10, v21, v01, v12)) {
              out[idx] = BiomeID.jungle_edge;
            } else {
              out[idx] = v11;
            }
          } else if (v11 === BiomeID.mountains || v11 === BiomeID.wooded_mountains || v11 === BiomeID.gravelly_mountains) {
            out[idx] = isAny4Oceanic(v10, v21, v01, v12) ? BiomeID.stone_shore : v11;
          } else if (isSnowy(v11)) {
            out[idx] = isAny4Oceanic(v10, v21, v01, v12) ? BiomeID.snowy_beach : v11;
          } else if (isMesa(v11)) {
            out[idx] = isAny4Oceanic(v10, v21, v01, v12) ? BiomeID.desert : v11;
          } else if (!isOceanic(v11) && v11 !== BiomeID.river && v11 !== BiomeID.swamp) {
            out[idx] = isAny4Oceanic(v10, v21, v01, v12) ? BiomeID.beach : v11;
          } else {
            out[idx] = v11;
          }
        }
      }
      return out;
    }
  }

  function reduceRiverID(id) {
    return id >= 2 ? 2 + (id & 1) : id;
  }

  class RiverLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let v01 = reduceRiverID(pMap[i + (j + 1) * pW]);
          let v11 = reduceRiverID(pMap[i + 1 + (j + 1) * pW]);
          let v21 = reduceRiverID(pMap[i + 2 + (j + 1) * pW]);
          let v10 = reduceRiverID(pMap[i + 1 + j * pW]);
          let v12 = reduceRiverID(pMap[i + 1 + (j + 2) * pW]);

          if (v11 === v01 && v11 === v10 && v11 === v12 && v11 === v21) {
            out[i + j * w] = -1;
          } else {
            out[i + j * w] = BiomeID.river;
          }
        }
      }
      return out;
    }
  }

  class SmoothLayer extends Layer {
    getMap(x, z, w, h) {
      const pX = x - 1, pZ = z - 1, pW = w + 2, pH = h + 2;
      const pMap = this.p.getMap(pX, pZ, pW, pH);
      const out = new Int32Array(w * h);
      const ss = this.startSeed;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let v11 = pMap[i + 1 + (j + 1) * pW];
          const v01 = pMap[i + (j + 1) * pW];
          const v10 = pMap[i + 1 + j * pW];

          if (v11 !== v01 || v11 !== v10) {
            const v21 = pMap[i + 2 + (j + 1) * pW];
            const v12 = pMap[i + 1 + (j + 2) * pW];

            if (v01 === v21 && v10 === v12) {
              const cs = getChunkSeed(ss, i + x, j + z);
              if (cs & (1n << 24n)) {
                v11 = v10;
              } else {
                v11 = v01;
              }
            } else {
              if (v01 === v21) v11 = v01;
              if (v10 === v12) v11 = v10;
            }
          }

          out[i + j * w] = v11;
        }
      }
      return out;
    }
  }

  class RiverMixLayer extends Layer {
    getMap(x, z, w, h) {
      const bMap = this.p.getMap(x, z, w, h);      // biome map
      const rMap = this.p2.getMap(x, z, w, h);     // river map
      const out = new Int32Array(w * h);

      for (let idx = 0; idx < w * h; idx++) {
        let v = bMap[idx];
        if (rMap[idx] === BiomeID.river && !isOceanic(v)) {
          if (v === BiomeID.snowy_tundra) v = BiomeID.frozen_river;
          else if (v === BiomeID.mushroom_fields || v === BiomeID.mushroom_field_shore) v = BiomeID.mushroom_field_shore;
          else v = BiomeID.river;
        }
        out[idx] = v;
      }
      return out;
    }
  }

  class OceanTempLayer extends Layer {
    setWorldSeed(worldSeed) {
      super.setWorldSeed(worldSeed);
      const PerlinClass = root.CubiomesNoise ? root.CubiomesNoise.PerlinNoise : null;
      if (PerlinClass) {
        this.noise = new PerlinClass(this.startSeed);
      }
    }

    getMap(x, z, w, h) {
      const out = new Int32Array(w * h);
      if (!this.noise) return out;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const tmp = this.noise.sample((i + x) / 8.0, 0, (j + z) / 8.0);
          if (tmp > 0.4) out[i + j * w] = BiomeID.warm_ocean;
          else if (tmp > 0.2) out[i + j * w] = BiomeID.lukewarm_ocean;
          else if (tmp < -0.4) out[i + j * w] = BiomeID.frozen_ocean;
          else if (tmp < -0.2) out[i + j * w] = BiomeID.cold_ocean;
          else out[i + j * w] = BiomeID.ocean;
        }
      }
      return out;
    }
  }

  class OceanMixLayer extends Layer {
    getMap(x, z, w, h) {
      const landMap = this.p.getMap(x, z, w, h);   // land / river mixed biomes
      const otyp = this.p2.getMap(x, z, w, h);     // ocean temperature map
      const out = new Int32Array(w * h);

      for (let idx = 0; idx < w * h; idx++) {
        const landID = landMap[idx];
        if (!isOceanic(landID)) {
          out[idx] = landID;
          continue;
        }

        let oceanID = otyp[idx];
        if (landID === BiomeID.deep_ocean) {
          switch (oceanID) {
            case BiomeID.lukewarm_ocean: oceanID = BiomeID.deep_lukewarm_ocean; break;
            case BiomeID.ocean: oceanID = BiomeID.deep_ocean; break;
            case BiomeID.cold_ocean: oceanID = BiomeID.deep_cold_ocean; break;
            case BiomeID.frozen_ocean: oceanID = BiomeID.deep_frozen_ocean; break;
          }
        }
        out[idx] = oceanID;
      }
      return out;
    }
  }

  // Export Layers
  const CubiomesLayers = {
    Layer,
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
  };

  root.CubiomesLayers = CubiomesLayers;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CubiomesLayers;
  }
})(typeof window !== 'undefined' ? window : globalThis);
