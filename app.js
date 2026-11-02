/**
 * Minecraft 1.16.1 Instant World Save Generator
 * ---------------------------------------------
 * Main Orchestrator / Application Controller
 * - Manages UI state & DOM interactions
 * - Coordinates seed parsing, NBT compilation, region generation, and 3D preview
 * - Handles client-side GZIP compression (Pako) and ZIP archive packaging (JSZip)
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. DOM Elements
  // =========================================================================

  const DOM = {
    form: document.getElementById('worldForm'),
    worldName: document.getElementById('worldName'),
    saveFolderName: document.getElementById('saveFolderName'),
    worldSeed: document.getElementById('worldSeed'),
    btnRandomSeed: document.getElementById('btnRandomSeed'),
    seedHelperText: document.getElementById('seedHelperText'),

    btnGameMode: document.getElementById('btnGameMode'),
    gameModeText: document.getElementById('gameModeText'),
    gameModeDesc: document.getElementById('gameModeDesc'),

    btnDifficulty: document.getElementById('btnDifficulty'),
    difficultyText: document.getElementById('difficultyText'),
    difficultyDesc: document.getElementById('difficultyDesc'),

    btnCheats: document.getElementById('btnCheats'),
    cheatsText: document.getElementById('cheatsText'),
    cheatsDesc: document.getElementById('cheatsDesc'),

    btnStructures: document.getElementById('btnStructures'),
    structuresText: document.getElementById('structuresText'),
    structuresDesc: document.getElementById('structuresDesc'),

    btnTerrain: document.getElementById('btnTerrain'),
    terrainText: document.getElementById('terrainText'),
    terrainDesc: document.getElementById('terrainDesc'),

    // 3D Preview Elements
    terrainCanvas: document.getElementById('terrainCanvas'),
    canvasWrapper: document.getElementById('canvasWrapper'),
    btnResetCamera: document.getElementById('btnResetCamera'),
    btnToggleMeshMode: document.getElementById('btnToggleMeshMode'),
    meshModeText: document.getElementById('meshModeText'),
    btnToggleXRay: document.getElementById('btnToggleXRay'),
    xrayText: document.getElementById('xrayText'),
    previewElevation: document.getElementById('previewElevation'),
    canvasOverlayLoading: document.getElementById('canvasOverlayLoading'),

    btnCreateWorld: document.getElementById('btnCreateWorld'),
    btnReset: document.getElementById('btnReset'),

    statusBanner: document.getElementById('statusBanner'),
    statusText: document.getElementById('statusText')
  };

  // =========================================================================
  // 2. State & Configuration Definitions
  // =========================================================================

  const TERRAIN_MODES = [
    {
      id: 'rolling_plains',
      label: 'Rolling Plains (Hills 3x3)',
      desc: '3-Octave Perlin noise hills (Y=62..72) with bedrock, stone, dirt & grass.',
      hasRegion: true,
      generatorType: 'rolling_plains'
    },
    {
      id: 'flat_3x3',
      label: 'Flat Grass (3x3 Chunks)',
      desc: 'Simple flat platform at Y=64: bedrock, stone, dirt & grass.',
      hasRegion: true,
      generatorType: 'flat'
    },
    {
      id: 'vanilla',
      label: 'Game Generated (Vanilla)',
      desc: 'Only level.dat. Minecraft engine will generate full terrain when world is opened.',
      hasRegion: false,
      generatorType: 'vanilla'
    }
  ];

  const GAME_MODES = [
    {
      id: 'survival',
      type: 0,
      hardcore: false,
      label: 'Survival',
      desc: 'Search for resources, crafting, gain levels, health and hunger.'
    },
    {
      id: 'hardcore',
      type: 0,
      hardcore: true,
      label: 'Hardcore',
      desc: 'Same as survival mode, locked at hardest difficulty, and one life only.'
    },
    {
      id: 'creative',
      type: 1,
      hardcore: false,
      label: 'Creative',
      desc: 'Unlimited resources, free flying and destroy blocks instantly.'
    }
  ];

  const DIFFICULTIES = [
    { id: 'peaceful', value: 0, label: 'Peaceful', desc: 'No monsters spawn, health regenerates automatically.' },
    { id: 'easy',     value: 1, label: 'Easy',     desc: 'Monsters spawn, but are weaker and hunger does not kill you.' },
    { id: 'normal',   value: 2, label: 'Normal',   desc: 'Standard survival, monsters spawn, starvation down to 1 HP.' },
    { id: 'hard',     value: 3, label: 'Hard',     desc: 'Monsters deal high damage, zombies break doors, starvation kills.' }
  ];

  let state = {
    gameModeIndex: 0,       // Default: Survival
    difficultyIndex: 2,     // Default: Normal
    allowCheats: false,     // Default: OFF
    generateStructures: true, // Default: ON
    terrainModeIndex: 0     // Default: Rolling Plains (Hills 3x3)
  };

  let terrainViewer = null;
  let seedDebounceTimer = null;

  // =========================================================================
  // 3. UI Update & Helper Functions
  // =========================================================================

  function sanitizeFolderName(name) {
    if (!name || !name.trim()) return 'New World';
    // Remove invalid filename characters on Windows/Unix
    const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    return sanitized || 'New World';
  }

  function updateSaveLocationHelper() {
    const rawName = DOM.worldName.value.trim() || 'New World';
    const folder = sanitizeFolderName(rawName);
    DOM.saveFolderName.textContent = `saves/${folder}`;
  }

  function updateGameModeUI() {
    const mode = GAME_MODES[state.gameModeIndex];
    DOM.gameModeText.textContent = mode.label;
    DOM.gameModeDesc.textContent = mode.desc;

    // Hardcore mode locks difficulty to Hard
    if (mode.hardcore) {
      DOM.difficultyText.textContent = 'Hard';
      DOM.difficultyDesc.textContent = 'Locked at Hardcore difficulty.';
      DOM.btnDifficulty.style.opacity = '0.6';
      DOM.btnDifficulty.style.pointerEvents = 'none';
    } else {
      DOM.btnDifficulty.style.opacity = '1';
      DOM.btnDifficulty.style.pointerEvents = 'auto';
      updateDifficultyUI();
    }
  }

  function updateDifficultyUI() {
    const mode = GAME_MODES[state.gameModeIndex];
    if (mode.hardcore) return;
    const diff = DIFFICULTIES[state.difficultyIndex];
    DOM.difficultyText.textContent = diff.label;
    DOM.difficultyDesc.textContent = diff.desc;
  }

  function updateCheatsUI() {
    DOM.cheatsText.textContent = state.allowCheats ? 'ON' : 'OFF';
    DOM.cheatsDesc.textContent = state.allowCheats
      ? 'Commands like /gamemode, /tp, /give are enabled.'
      : 'Commands like /gamemode, /tp are disabled.';
  }

  function updateStructuresUI() {
    DOM.structuresText.textContent = state.generateStructures ? 'ON' : 'OFF';
    DOM.structuresDesc.textContent = state.generateStructures
      ? 'Villages, dungeons, mineshafts, etc. will spawn.'
      : 'Villages, dungeons, mineshafts, etc. will not spawn.';
  }

  function updateTerrainUI() {
    if (!DOM.terrainText || !DOM.terrainDesc) return;
    const terrain = TERRAIN_MODES[state.terrainModeIndex];
    DOM.terrainText.textContent = terrain.label;
    DOM.terrainDesc.textContent = terrain.desc;
  }

  function setStatus(message, type = 'info') {
    DOM.statusBanner.className = 'mc-status-banner';
    DOM.statusText.textContent = message;

    const spinner = DOM.statusBanner.querySelector('.mc-spinner');

    if (type === 'loading') {
      if (spinner) spinner.style.display = 'block';
    } else {
      if (spinner) spinner.style.display = 'none';
      if (type === 'success') {
        DOM.statusBanner.classList.add('success');
      } else if (type === 'error') {
        DOM.statusBanner.classList.add('error');
      }
    }
  }

  function hideStatus() {
    DOM.statusBanner.className = 'mc-status-banner hidden';
  }

  // =========================================================================
  // 4. Attach Event Listeners
  // =========================================================================

  DOM.worldName.addEventListener('input', updateSaveLocationHelper);

  DOM.btnGameMode.addEventListener('click', () => {
    state.gameModeIndex = (state.gameModeIndex + 1) % GAME_MODES.length;
    updateGameModeUI();
  });

  DOM.btnDifficulty.addEventListener('click', () => {
    const mode = GAME_MODES[state.gameModeIndex];
    if (mode.hardcore) return;
    state.difficultyIndex = (state.difficultyIndex + 1) % DIFFICULTIES.length;
    updateDifficultyUI();
  });

  DOM.btnCheats.addEventListener('click', () => {
    state.allowCheats = !state.allowCheats;
    updateCheatsUI();
  });

  DOM.btnStructures.addEventListener('click', () => {
    state.generateStructures = !state.generateStructures;
    updateStructuresUI();
  });

  const handleSeedChange = () => {
    if (terrainViewer) terrainViewer.updateTerrain();
  };

  DOM.worldSeed.addEventListener('input', () => {
    clearTimeout(seedDebounceTimer);
    seedDebounceTimer = setTimeout(handleSeedChange, 150);
  });

  DOM.worldSeed.addEventListener('change', () => {
    clearTimeout(seedDebounceTimer);
    handleSeedChange();
  });

  // Curated seeds with distinctive biomes & terrain features
  const CURATED_SEEDS = [
    { seed: '8675309', label: 'Rolling Meadow & Oak Forest' },
    { seed: '-123456789012345678', label: 'Mountain Peaks & Valleys' },
    { seed: '1908432578', label: 'Desert Oasis & Cacti Dunes' },
    { seed: '-4321987654321', label: 'Emerald Birch Woodlands' },
    { seed: '9876543210', label: 'Pine Taiga Highlands' },
    { seed: '202011161', label: 'Minecraft 1.16.1 Classic' },
    { seed: '1357924680', label: 'Plains River Crossings' },
    { seed: '-89123476512', label: 'Highland Mountain Ridge' }
  ];

  if (DOM.btnRandomSeed) {
    DOM.btnRandomSeed.addEventListener('click', () => {
      // Trigger dice spin animation
      DOM.btnRandomSeed.classList.add('rolling');
      setTimeout(() => DOM.btnRandomSeed.classList.remove('rolling'), 350);

      let seedStr = '';
      let seedLabel = '';

      // 40% chance pick curated, 60% chance true 64-bit random signed integer
      if (Math.random() < 0.45) {
        const pick = CURATED_SEEDS[Math.floor(Math.random() * CURATED_SEEDS.length)];
        seedStr = pick.seed;
        seedLabel = pick.label;
      } else {
        // Authentic 64-bit signed integer for Minecraft Java Edition
        const high = BigInt(Math.floor(Math.random() * 0xFFFFFFFF)) - 0x80000000n;
        const low = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
        const val = BigInt.asIntN(64, (high << 32n) | low);
        seedStr = val.toString();
        seedLabel = 'Random 64-bit Seed';
      }

      DOM.worldSeed.value = seedStr;

      if (DOM.seedHelperText) {
        DOM.seedHelperText.innerHTML = `🎲 Seed: <span class="highlight-text">${seedLabel}</span> (${seedStr})`;
      }

      // Immediately regenerate 3D terrain preview without debounce delay
      clearTimeout(seedDebounceTimer);
      handleSeedChange();
    });
  }

  if (DOM.btnTerrain) {
    DOM.btnTerrain.addEventListener('click', () => {
      state.terrainModeIndex = (state.terrainModeIndex + 1) % TERRAIN_MODES.length;
      updateTerrainUI();
      if (terrainViewer) terrainViewer.updateTerrain();
    });
  }

  DOM.btnReset.addEventListener('click', () => {
    DOM.worldName.value = 'New World';
    DOM.worldSeed.value = '';
    state.gameModeIndex = 0;
    state.difficultyIndex = 2;
    state.allowCheats = false;
    state.generateStructures = true;
    state.terrainModeIndex = 0;

    updateSaveLocationHelper();
    updateGameModeUI();
    updateCheatsUI();
    updateStructuresUI();
    updateTerrainUI();
    if (DOM.seedHelperText) {
      DOM.seedHelperText.textContent = 'Leave blank for a random seed, or click Random for an epic seed.';
    }
    hideStatus();
    if (terrainViewer) terrainViewer.updateTerrain();
  });

  // =========================================================================
  // 5. World Generation & ZIP Packaging Trigger
  // =========================================================================

  async function handleCreateWorld() {
    // Check prerequisites
    if (typeof window.pako === 'undefined') {
      setStatus('Error: Pako library failed to load from CDN.', 'error');
      return;
    }
    if (typeof window.JSZip === 'undefined') {
      setStatus('Error: JSZip library failed to load from CDN.', 'error');
      return;
    }

    const worldNameRaw = DOM.worldName.value.trim() || 'New World';
    const folderName = sanitizeFolderName(worldNameRaw);
    const activeMode = GAME_MODES[state.gameModeIndex];
    const difficultyVal = activeMode.hardcore ? 3 : DIFFICULTIES[state.difficultyIndex].value;
    const seed = window.parseMinecraftSeed(DOM.worldSeed.value);
    const activeTerrain = TERRAIN_MODES[state.terrainModeIndex];

    // Disable button and show progress
    DOM.btnCreateWorld.disabled = true;
    DOM.btnCreateWorld.style.opacity = '0.7';
    setStatus(`Preparing world generation for "${worldNameRaw}"...`, 'loading');

    try {
      let mcaBytes = null;
      let spawnX = 0;
      let spawnY = 64;
      let spawnZ = 0;

      // 1. Generate Region & Chunks if enabled
      if (activeTerrain.hasRegion) {
        const isRolling = activeTerrain.generatorType === 'rolling_plains';
        const terrain = isRolling ? new window.RollingPlainsTerrain(seed) : null;
        const BiomeClass = window.VanillaBiomeGenerator || window.BiomeGenerator;
        const biomeGen = (isRolling && BiomeClass) ? new BiomeClass(seed) : null;
        const getTreesFunc = window.getBiomeTrees || window.getTreeLocations;
        const trees = (getTreesFunc && isRolling && terrain)
          ? getTreesFunc(seed, terrain, biomeGen, false)
          : [];

        // Calculate safe spawn position directly on top of surface in Chunk (0,0)
        spawnX = 8;
        spawnZ = 8;
        spawnY = (isRolling ? terrain.getHeight(8, 8, biomeGen) : 64) + 1;

        const spawnBiomeId = biomeGen ? biomeGen.getBiomeAt(8, 8, spawnY) : 1;
        const biomeNames = {
          0: 'Ocean', 1: 'Plains', 2: 'Desert', 3: 'Mountains', 4: 'Forest', 5: 'Taiga', 6: 'Swamp', 7: 'River',
          10: 'Frozen Ocean', 11: 'Frozen River', 12: 'Snowy Tundra', 13: 'Snowy Mountains', 14: 'Mushroom Fields',
          15: 'Mushroom Shore', 16: 'Beach', 17: 'Desert Hills', 18: 'Wooded Hills', 19: 'Taiga Hills',
          21: 'Jungle', 22: 'Jungle Hills', 23: 'Jungle Edge', 24: 'Deep Ocean', 25: 'Stone Shore', 26: 'Snowy Beach',
          27: 'Birch Forest', 28: 'Birch Forest Hills', 29: 'Dark Forest', 30: 'Snowy Taiga', 31: 'Snowy Taiga Hills',
          32: 'Giant Tree Taiga', 33: 'Giant Tree Taiga Hills', 34: 'Wooded Mountains', 35: 'Savanna', 36: 'Savanna Plateau',
          37: 'Badlands', 38: 'Wooded Badlands Plateau', 39: 'Badlands Plateau', 44: 'Warm Ocean', 45: 'Lukewarm Ocean',
          46: 'Cold Ocean', 47: 'Deep Warm Ocean', 48: 'Deep Lukewarm Ocean', 49: 'Deep Cold Ocean', 50: 'Deep Frozen Ocean',
          129: 'Sunflower Plains', 130: 'Desert Lakes', 131: 'Gravelly Mountains', 132: 'Flower Forest', 133: 'Taiga Mountains',
          134: 'Swamp Hills', 140: 'Ice Spikes', 149: 'Modified Jungle', 151: 'Modified Jungle Edge', 155: 'Tall Birch Forest',
          156: 'Tall Birch Hills', 157: 'Dark Forest Hills', 158: 'Snowy Taiga Mountains', 160: 'Giant Spruce Taiga',
          161: 'Giant Spruce Taiga Hills', 162: 'Modified Gravelly Mountains', 163: 'Shattered Savanna', 164: 'Shattered Savanna Plateau',
          165: 'Eroded Badlands', 166: 'Modified Wooded Badlands Plateau', 167: 'Modified Badlands Plateau', 168: 'Bamboo Jungle', 169: 'Bamboo Jungle Hills'
        };
        const bName = biomeNames[spawnBiomeId] || `Biome #${spawnBiomeId}`;

        const statusLabel = isRolling
          ? `Generating ${bName} (${trees.length} trees & underground ore veins)...`
          : 'Generating 9 Flat spawn chunks...';
        setStatus(statusLabel, 'loading');
        await new Promise(r => setTimeout(r, 60)); // Yield to render UI

        const chunks = [];
        for (let cx = 0; cx < 3; cx++) {
          for (let cz = 0; cz < 3; cz++) {
            const chunkOres = (isRolling && window.generateChunkOres)
              ? window.generateChunkOres(seed, cx, cz)
              : [];
            const chunkFlora = (isRolling && window.getChunkFlora)
              ? window.getChunkFlora(seed, cx, cz, terrain, biomeGen, trees)
              : [];
            const rawChunkBytes = window.buildTerrainChunkNbt(cx, cz, terrain, !isRolling, trees, biomeGen, chunkOres, chunkFlora);
            // ZLIB compression (RFC 1950) via pako.deflate
            const compChunk = window.pako.deflate(rawChunkBytes);
            chunks.push({ cx, cz, compData: compChunk });
          }
        }

        setStatus('Compiling Overworld Region file (r.0.0.mca)...', 'loading');
        await new Promise(r => setTimeout(r, 60)); // Yield to render UI
        mcaBytes = window.buildRegionMca(chunks);
      }

      // 2. Build level.dat NBT binary bytes
      setStatus('Building level.dat metadata...', 'loading');
      await new Promise(r => setTimeout(r, 60)); // Yield to render UI

      const rawNbtBytes = window.buildLevelDatBytes({
        worldName: worldNameRaw,
        gameType: activeMode.type,
        hardcore: activeMode.hardcore,
        difficulty: difficultyVal,
        allowCheats: state.allowCheats,
        generateStructures: state.generateStructures,
        seed: seed,
        hasRegion: activeTerrain.hasRegion,
        spawnX: spawnX,
        spawnY: spawnY,
        spawnZ: spawnZ
      });

      setStatus('Compressing level.dat with GZIP...', 'loading');
      await new Promise(r => setTimeout(r, 60)); // Yield to render UI

      // GZIP compression via Pako
      const gzippedLevelDat = window.pako.gzip(rawNbtBytes);

      setStatus('Packaging files into Minecraft save .ZIP...', 'loading');
      await new Promise(r => setTimeout(r, 60)); // Yield to render UI

      // 3. Create ZIP structure via JSZip
      const zip = new window.JSZip();
      const worldFolder = zip.folder(folderName);

      // Minecraft saves require level.dat and level.dat_old (backup)
      worldFolder.file('level.dat', gzippedLevelDat);
      worldFolder.file('level.dat_old', gzippedLevelDat);

      // Add pre-generated region file if available
      if (mcaBytes) {
        const regionFolder = worldFolder.folder('region');
        regionFolder.file('r.0.0.mca', mcaBytes);
      }

      // Generate the ZIP blob
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // 4. Trigger download
      const downloadUrl = URL.createObjectURL(zipBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      downloadAnchor.download = `${folderName}.zip`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

      const terrainMsg = activeTerrain.hasRegion ? ` (${activeTerrain.label} at spawn Y=${spawnY})` : '';
      setStatus(`Success! Downloaded "${folderName}.zip"${terrainMsg}. Extract it into .minecraft/saves!`, 'success');
    } catch (err) {
      console.error('World generation failed:', err);
      setStatus(`Generation error: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      DOM.btnCreateWorld.disabled = false;
      DOM.btnCreateWorld.style.opacity = '1';
    }
  }

  // =========================================================================
  // 6. Initialization & Bootstrap
  // =========================================================================

  DOM.btnCreateWorld.addEventListener('click', handleCreateWorld);

  // Initial UI Render
  updateSaveLocationHelper();
  updateGameModeUI();
  updateCheatsUI();
  updateStructuresUI();
  updateTerrainUI();

  // Initialize 3D WebGL Terrain Preview
  if (window.TerrainViewer3D) {
    terrainViewer = new window.TerrainViewer3D({
      canvas: DOM.terrainCanvas,
      wrapper: DOM.canvasWrapper,
      elevationElem: DOM.previewElevation,
      meshModeTextElem: DOM.meshModeText,
      btnResetCamera: DOM.btnResetCamera,
      btnToggleMeshMode: DOM.btnToggleMeshMode,
      btnToggleXRay: DOM.btnToggleXRay,
      xrayTextElem: DOM.xrayText,
      getSeedFunc: () => window.parseMinecraftSeed(DOM.worldSeed.value),
      getTerrainModeFunc: () => TERRAIN_MODES[state.terrainModeIndex].generatorType
    });
  }

  // Auto-refresh terrain when Cubiomes 1.16 WASM engine completes loading
  if (typeof window.initCubiomesWasm === 'function') {
    window.initCubiomesWasm().then(() => {
      if (terrainViewer) {
        terrainViewer.updateTerrain();
      }
    }).catch(() => {});
  }

})();
