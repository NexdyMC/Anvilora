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

  DOM.worldSeed.addEventListener('input', () => {
    clearTimeout(seedDebounceTimer);
    seedDebounceTimer = setTimeout(() => {
      if (terrainViewer) terrainViewer.updateTerrain();
    }, 200);
  });

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

        // Calculate safe spawn position directly on top of grass in Chunk (0,0)
        spawnX = 8;
        spawnZ = 8;
        spawnY = (isRolling ? terrain.getHeight(8, 8) : 64) + 1;

        const statusLabel = isRolling
          ? 'Generating Rolling Plains (3-Octave Perlin hills)...'
          : 'Generating 9 Flat spawn chunks...';
        setStatus(statusLabel, 'loading');
        await new Promise(r => setTimeout(r, 60)); // Yield to render UI

        const chunks = [];
        for (let cx = 0; cx < 3; cx++) {
          for (let cz = 0; cz < 3; cz++) {
            const rawChunkBytes = window.buildTerrainChunkNbt(cx, cz, terrain, !isRolling);
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
      getSeedFunc: () => window.parseMinecraftSeed(DOM.worldSeed.value),
      getTerrainModeFunc: () => TERRAIN_MODES[state.terrainModeIndex].generatorType
    });
  }

})();
