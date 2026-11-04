/**
 * Pure Binary NBT (Named Binary Tag) Big-Endian Serializer
 * --------------------------------------------------------
 * Standards-compliant NBT writer for Minecraft Java Edition:
 * - Big-endian byte order
 * - Supports Compound, List, String, IntArray, LongArray, and primitives
 * - Generates valid 1.16.1 level.dat structure (DataVersion 2567)
 */

(function (root) {
  'use strict';

  const NBT_TAGS = {
    TAG_End: 0,
    TAG_Byte: 1,
    TAG_Short: 2,
    TAG_Int: 3,
    TAG_Long: 4,
    TAG_Float: 5,
    TAG_Double: 6,
    TAG_Byte_Array: 7,
    TAG_String: 8,
    TAG_List: 9,
    TAG_Compound: 10,
    TAG_Int_Array: 11,
    TAG_Long_Array: 12
  };

  class NBTWriter {
    constructor() {
      this.buffer = new Uint8Array(4096);
      this.view = new DataView(this.buffer.buffer);
      this.offset = 0;
      this.textEncoder = new TextEncoder();
    }

    ensureCapacity(neededBytes) {
      if (this.offset + neededBytes > this.buffer.length) {
        let newSize = Math.max(this.buffer.length * 2, this.offset + neededBytes + 1024);
        const newBuffer = new Uint8Array(newSize);
        newBuffer.set(this.buffer);
        this.buffer = newBuffer;
        this.view = new DataView(this.buffer.buffer);
      }
    }

    writeTagHeader(type, name) {
      this.writeByte(type);
      if (type !== NBT_TAGS.TAG_End) {
        this.writeStringRaw(name || '');
      }
    }

    writeByte(val) {
      this.ensureCapacity(1);
      this.view.setInt8(this.offset, Number(val));
      this.offset += 1;
    }

    writeShort(val) {
      this.ensureCapacity(2);
      this.view.setInt16(this.offset, Number(val), false); // Big-Endian
      this.offset += 2;
    }

    writeInt(val) {
      this.ensureCapacity(4);
      this.view.setInt32(this.offset, Number(val), false); // Big-Endian
      this.offset += 4;
    }

    writeLong(val) {
      this.ensureCapacity(8);
      const big = typeof val === 'bigint' ? val : BigInt(val);
      this.view.setBigInt64(this.offset, big, false); // Big-Endian
      this.offset += 8;
    }

    writeFloat(val) {
      this.ensureCapacity(4);
      this.view.setFloat32(this.offset, Number(val), false);
      this.offset += 4;
    }

    writeDouble(val) {
      this.ensureCapacity(8);
      this.view.setFloat64(this.offset, Number(val), false);
      this.offset += 8;
    }

    writeStringRaw(str) {
      const encoded = this.textEncoder.encode(str);
      this.writeShort(encoded.length);
      this.ensureCapacity(encoded.length);
      this.buffer.set(encoded, this.offset);
      this.offset += encoded.length;
    }

    // High-level named tag writers
    tagByte(name, val) {
      this.writeTagHeader(NBT_TAGS.TAG_Byte, name);
      this.writeByte(val);
    }

    tagShort(name, val) {
      this.writeTagHeader(NBT_TAGS.TAG_Short, name);
      this.writeShort(val);
    }

    tagInt(name, val) {
      this.writeTagHeader(NBT_TAGS.TAG_Int, name);
      this.writeInt(val);
    }

    tagLong(name, val) {
      this.writeTagHeader(NBT_TAGS.TAG_Long, name);
      this.writeLong(val);
    }

    tagString(name, val) {
      this.writeTagHeader(NBT_TAGS.TAG_String, name);
      this.writeStringRaw(val);
    }

    startCompound(name) {
      this.writeTagHeader(NBT_TAGS.TAG_Compound, name);
    }

    endCompound() {
      this.writeByte(NBT_TAGS.TAG_End);
    }

    startList(name, itemType, length) {
      this.writeTagHeader(NBT_TAGS.TAG_List, name);
      this.writeByte(itemType);
      this.writeInt(length);
    }

    tagIntArray(name, array) {
      this.writeTagHeader(NBT_TAGS.TAG_Int_Array, name);
      this.writeInt(array.length);
      this.ensureCapacity(array.length * 4);
      for (let i = 0; i < array.length; i++) {
        this.view.setInt32(this.offset, array[i], false);
        this.offset += 4;
      }
    }

    tagLongArray(name, array) {
      this.writeTagHeader(NBT_TAGS.TAG_Long_Array, name);
      this.writeInt(array.length);
      this.ensureCapacity(array.length * 8);
      for (let i = 0; i < array.length; i++) {
        const big = typeof array[i] === 'bigint' ? array[i] : BigInt(array[i]);
        this.view.setBigInt64(this.offset, big, false);
        this.offset += 8;
      }
    }

    getBytes() {
      return this.buffer.subarray(0, this.offset);
    }
  }

  /**
   * Build level.dat for Minecraft 1.16.1 (DataVersion: 2567)
   */
  function buildLevelDatBytes(options) {
    const nbt = new NBTWriter();
    const seed = options.seed;
    const now = BigInt(Date.now());

    // Root Compound (unnamed in Java edition)
    nbt.startCompound('');

    // "Data" Compound
    nbt.startCompound('Data');

    // General Level Data
    nbt.tagInt('DataVersion', 2567); // 1.16.1
    nbt.tagString('LevelName', options.worldName);
    nbt.tagString('generatorName', 'default');
    nbt.tagInt('generatorVersion', 1);

    // Empty generator options compound
    nbt.startCompound('generatorOptions');
    nbt.endCompound();

    nbt.tagInt('GameType', options.gameType);
    nbt.tagByte('hardcore', options.hardcore ? 1 : 0);
    nbt.tagByte('allowCommands', options.allowCheats ? 1 : 0);
    nbt.tagByte('MapFeatures', options.generateStructures ? 1 : 0);
    nbt.tagByte('Difficulty', options.difficulty);
    nbt.tagByte('DifficultyLocked', options.hardcore ? 1 : 0);

    // Initial Coordinates & World Time
    const hasRegion = Boolean(options.hasRegion);
    const spawnX = options.spawnX !== undefined ? options.spawnX : (hasRegion ? 8 : 0);
    const spawnY = options.spawnY !== undefined ? options.spawnY : (hasRegion ? 65 : 64);
    const spawnZ = options.spawnZ !== undefined ? options.spawnZ : (hasRegion ? 8 : 0);
    nbt.tagInt('SpawnX', spawnX);
    nbt.tagInt('SpawnY', spawnY);
    nbt.tagInt('SpawnZ', spawnZ);
    nbt.tagLong('Time', 0n);
    nbt.tagLong('DayTime', 0n);
    nbt.tagLong('LastPlayed', now);
    nbt.tagLong('RandomSeed', seed);

    // Initialized = 1 if chunks pre-generated, 0 if Minecraft should generate
    nbt.tagByte('initialized', hasRegion ? 1 : 0);
    nbt.tagInt('clearWeatherTime', 0);
    nbt.tagInt('rainTime', 100000);
    nbt.tagByte('raining', 0);
    nbt.tagInt('thunderTime', 100000);
    nbt.tagByte('thundering', 0);
    nbt.tagInt('version', 19133); // Minecraft Anvil save format version

    // GameRules compound
    const gr = options.gameRules || {};
    nbt.startCompound('GameRules');
    nbt.tagString('doDaylightCycle', gr.doDaylightCycle !== false ? 'true' : 'false');
    nbt.tagString('doMobSpawning', gr.doMobSpawning !== false ? 'true' : 'false');
    nbt.tagString('doWeatherCycle', gr.doWeatherCycle !== false ? 'true' : 'false');
    nbt.tagString('keepInventory', gr.keepInventory ? 'true' : 'false');
    nbt.tagString('mobGriefing', gr.mobGriefing !== false ? 'true' : 'false');
    nbt.endCompound();

    // Version Compound (Critical to prevent "Unknown Version" warning)
    nbt.startCompound('Version');
    nbt.tagInt('Id', 2567);
    nbt.tagString('Name', '1.16.1');
    nbt.tagByte('Snapshot', 0);
    nbt.endCompound();

    // WorldGenSettings Compound (Required for 1.16.1 world generation)
    nbt.startCompound('WorldGenSettings');
    nbt.tagLong('seed', seed);
    nbt.tagByte('generate_features', options.generateStructures ? 1 : 0);
    nbt.tagByte('bonus_chest', 0);

    // Dimensions Compound
    nbt.startCompound('dimensions');

    // 1. Overworld
    nbt.startCompound('minecraft:overworld');
    nbt.tagString('type', 'minecraft:overworld');
    nbt.startCompound('generator');
    nbt.tagString('type', 'minecraft:noise');
    nbt.tagLong('seed', seed);
    nbt.tagString('settings', 'minecraft:overworld');
    nbt.startCompound('biome_source');
    nbt.tagString('type', 'minecraft:vanilla_layered');
    nbt.tagLong('seed', seed);
    nbt.tagByte('large_biomes', 0);
    nbt.endCompound(); // biome_source
    nbt.endCompound(); // generator
    nbt.endCompound(); // minecraft:overworld

    // 2. The Nether
    nbt.startCompound('minecraft:the_nether');
    nbt.tagString('type', 'minecraft:the_nether');
    nbt.startCompound('generator');
    nbt.tagString('type', 'minecraft:noise');
    nbt.tagLong('seed', seed);
    nbt.tagString('settings', 'minecraft:nether');
    nbt.startCompound('biome_source');
    nbt.tagString('type', 'minecraft:multi_noise');
    nbt.tagLong('seed', seed);
    nbt.tagString('preset', 'minecraft:nether');
    nbt.endCompound(); // biome_source
    nbt.endCompound(); // generator
    nbt.endCompound(); // minecraft:the_nether

    // 3. The End
    nbt.startCompound('minecraft:the_end');
    nbt.tagString('type', 'minecraft:the_end');
    nbt.startCompound('generator');
    nbt.tagString('type', 'minecraft:noise');
    nbt.tagLong('seed', seed);
    nbt.tagString('settings', 'minecraft:end');
    nbt.startCompound('biome_source');
    nbt.tagString('type', 'minecraft:the_end');
    nbt.tagLong('seed', seed);
    nbt.endCompound(); // biome_source
    nbt.endCompound(); // generator
    nbt.endCompound(); // minecraft:the_end

    nbt.endCompound(); // dimensions
    nbt.endCompound(); // WorldGenSettings

    nbt.endCompound(); // Data
    nbt.endCompound(); // Root

    return nbt.getBytes();
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NBT_TAGS, NBTWriter, buildLevelDatBytes };
  } else {
    root.NBT_TAGS = NBT_TAGS;
    root.NBTWriter = NBTWriter;
    root.buildLevelDatBytes = buildLevelDatBytes;
  }
})(typeof window !== 'undefined' ? window : globalThis);
