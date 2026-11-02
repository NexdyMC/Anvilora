/**
 * Overworld Region (.MCA) Anvil File Generator
 * --------------------------------------------
 * Compiles Minecraft region files (e.g. r.0.0.mca):
 * - 8192 bytes header:
 *   - 0..4095: Sector offsets & sector counts for up to 1024 chunks (32x32)
 *   - 4096..8191: Timestamps (epoch seconds)
 * - Sector padding to 4096-byte boundaries
 * - Chunk payload header: 4-byte length + 1-byte compression type (2 = ZLIB)
 */

(function (root) {
  'use strict';

  function buildRegionMca(chunks) {
    // chunks is array of { cx, cz, compData: Uint8Array }
    const locs = new Uint32Array(1024);
    const timestamps = new Uint32Array(1024);
    const nowEpoch = Math.floor(Date.now() / 1000);

    let currentSector = 2; // Sectors 0 and 1 are 8KB header
    const chunkBlobs = [];

    for (const chunk of chunks) {
      const relX = chunk.cx & 31;
      const relZ = chunk.cz & 31;
      const locIdx = relX + relZ * 32;

      // 4 bytes length + 1 byte compression (2 = zlib) + compData
      const dataLen = 1 + chunk.compData.length;
      const chunkBlob = new Uint8Array(4 + dataLen);
      const view = new DataView(chunkBlob.buffer);
      view.setUint32(0, dataLen, false); // Big-Endian length
      chunkBlob[4] = 2; // 2 = zlib
      chunkBlob.set(chunk.compData, 5);

      // Pad to 4096 sector boundary
      const sectorCount = Math.ceil(chunkBlob.length / 4096);
      const paddedLen = sectorCount * 4096;
      let finalChunk = chunkBlob;
      if (chunkBlob.length < paddedLen) {
        finalChunk = new Uint8Array(paddedLen);
        finalChunk.set(chunkBlob);
      }

      locs[locIdx] = ((currentSector & 0xFFFFFF) << 8) | (sectorCount & 0xFF);
      timestamps[locIdx] = nowEpoch;

      currentSector += sectorCount;
      chunkBlobs.push(finalChunk);
    }

    // Total size: 8192 bytes header + all chunks
    const totalSize = 8192 + chunkBlobs.reduce((acc, b) => acc + b.length, 0);
    const mca = new Uint8Array(totalSize);
    const mcaView = new DataView(mca.buffer);

    for (let i = 0; i < 1024; i++) {
      mcaView.setUint32(i * 4, locs[i], false);
      mcaView.setUint32(4096 + i * 4, timestamps[i], false);
    }

    let offset = 8192;
    for (const b of chunkBlobs) {
      mca.set(b, offset);
      offset += b.length;
    }

    return mca;
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildRegionMca };
  } else {
    root.buildRegionMca = buildRegionMca;
  }
})(typeof window !== 'undefined' ? window : globalThis);
