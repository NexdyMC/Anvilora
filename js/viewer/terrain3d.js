/**
 * 3D World Terrain Preview (Interactive WebGL via Three.js)
 * ---------------------------------------------------------
 * - High performance Voxel Mode using THREE.InstancedMesh (60 FPS, ~12k blocks, 5 draw calls)
 * - Solid Mode using dynamic BufferGeometry with vertex colors
 * - Animated glowing gold beacon marker for player spawn point
 * - OrbitControls: Left-drag to rotate, scroll to zoom, right-drag to pan
 * - Camera reset & automatic responsive canvas resizing
 */

(function (root) {
  'use strict';

  class TerrainViewer3D {
    constructor(options = {}) {
      this.canvas = options.canvas || document.getElementById('terrainCanvas');
      this.wrapper = options.wrapper || document.getElementById('canvasWrapper');
      this.elevationElem = options.elevationElem || document.getElementById('previewElevation');
      this.meshModeTextElem = options.meshModeTextElem || document.getElementById('meshModeText');
      this.btnResetCamera = options.btnResetCamera || document.getElementById('btnResetCamera');
      this.btnToggleMeshMode = options.btnToggleMeshMode || document.getElementById('btnToggleMeshMode');
      this.getSeedFunc = options.getSeedFunc || (() => 0n);
      this.getTerrainModeFunc = options.getTerrainModeFunc || (() => 'rolling_plains');

      if (!this.canvas || !this.wrapper) return;

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;

      this.voxelGroup = null;
      this.solidGroup = null;
      this.markerGroup = null;
      this.markerDiamond = null;

      this.currentMode = 'voxel'; // 'voxel' or 'solid'
      this.currentHeights = new Int32Array(48 * 48);
      this.spawnCoords = { x: 8, y: 68, z: 8 };

      this.materials = null;
      this.boxGeo = null;

      this.isInitialized = false;
      this.init();
    }

    init() {
      if (typeof window.THREE === 'undefined' || typeof window.THREE.OrbitControls === 'undefined') {
        // Retry shortly if CDN scripts are still downloading
        setTimeout(() => this.init(), 100);
        return;
      }

      const width = this.wrapper.clientWidth || 600;
      const height = this.wrapper.clientHeight || 320;

      // 1. Scene & Camera
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 500);

      // 2. Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height);

      // 3. OrbitControls
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep above horizon
      this.controls.minDistance = 15;
      this.controls.maxDistance = 180;
      this.resetCamera();

      // 4. Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
      this.scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0xfffaed, 0.85);
      dirLight1.position.set(50, 80, 40);
      this.scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x7ea0c4, 0.35);
      dirLight2.position.set(-40, 30, -30);
      this.scene.add(dirLight2);

      // 5. Materials (Exact colors specified)
      this.materials = {
        grass: new THREE.MeshLambertMaterial({ color: 0x5B8C32 }),
        dirt: new THREE.MeshLambertMaterial({ color: 0x866043 }),
        stone: new THREE.MeshLambertMaterial({ color: 0x6E6E6E }),
        bedrock: new THREE.MeshLambertMaterial({ color: 0x2C2C2C }),
        water: new THREE.MeshLambertMaterial({
          color: 0x2F5BC4,
          transparent: true,
          opacity: 0.75,
          depthWrite: false
        })
      };

      this.boxGeo = new THREE.BoxGeometry(1, 1, 1);

      // 6. Groups
      this.voxelGroup = new THREE.Group();
      this.solidGroup = new THREE.Group();
      this.markerGroup = new THREE.Group();

      this.scene.add(this.voxelGroup);
      this.scene.add(this.solidGroup);
      this.scene.add(this.markerGroup);

      this.solidGroup.visible = false; // Start in voxel mode

      // 7. Spawn Marker
      this.buildSpawnMarker();

      // 8. Event Listeners
      window.addEventListener('resize', () => this.onResize());
      if (window.ResizeObserver) {
        new ResizeObserver(() => this.onResize()).observe(this.wrapper);
      }

      if (this.btnResetCamera) {
        this.btnResetCamera.addEventListener('click', () => this.resetCamera());
      }

      if (this.btnToggleMeshMode) {
        this.btnToggleMeshMode.addEventListener('click', () => this.toggleMode());
      }

      this.isInitialized = true;

      // 9. Start Render Loop
      this.animate();

      // Initial terrain build
      this.updateTerrain();
    }

    resetCamera() {
      if (!this.camera || !this.controls) return;
      // Center of 48x48 chunk is (23.5, 65, 23.5)
      this.controls.target.set(23.5, 65, 23.5);
      this.camera.position.set(23.5 + 44, 65 + 32, 23.5 + 44);
      this.controls.update();
    }

    toggleMode() {
      this.currentMode = (this.currentMode === 'voxel' ? 'solid' : 'voxel');
      if (this.meshModeTextElem) {
        this.meshModeTextElem.textContent = (this.currentMode === 'voxel' ? 'Voxel' : 'Solid');
      }
      this.voxelGroup.visible = (this.currentMode === 'voxel');
      this.solidGroup.visible = (this.currentMode === 'solid');
    }

    onResize() {
      if (!this.renderer || !this.camera || !this.wrapper) return;
      const width = this.wrapper.clientWidth || 600;
      const height = this.wrapper.clientHeight || 320;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

    buildSpawnMarker() {
      // Clear previous marker children
      while (this.markerGroup.children.length > 0) {
        this.markerGroup.remove(this.markerGroup.children[0]);
      }

      // Outer gold glowing diamond / beacon crystal
      const diaGeo = new THREE.OctahedronGeometry(0.75, 0);
      const diaMat = new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        emissive: 0xFF5500,
        emissiveIntensity: 0.7,
        roughness: 0.2,
        metalness: 0.8
      });
      this.markerDiamond = new THREE.Mesh(diaGeo, diaMat);
      this.markerGroup.add(this.markerDiamond);

      // Pin needle / shaft pointing down to block surface
      const pinGeo = new THREE.CylinderGeometry(0.06, 0.02, 1.2, 8);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.y = -0.7;
      this.markerGroup.add(pinMesh);

      // Red pulse target ring on top of grass block
      const ringGeo = new THREE.RingGeometry(0.2, 0.65, 16);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xFF3333,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = -1.35;
      this.markerGroup.add(ringMesh);
    }

    updateTerrain() {
      if (!this.isInitialized) return;

      const seed = this.getSeedFunc();
      const terrainType = this.getTerrainModeFunc();

      const isRolling = terrainType === 'rolling_plains' || terrainType === 'vanilla';
      const isFlat = terrainType === 'flat';
      const TerrainClass = root.RollingPlainsTerrain;
      const terrain = isRolling && TerrainClass ? new TerrainClass(seed) : null;

      // Calculate 48x48 heights
      for (let z = 0; z < 48; z++) {
        for (let x = 0; x < 48; x++) {
          this.currentHeights[z * 48 + x] = isFlat || !terrain ? 64 : terrain.getHeight(x, z);
        }
      }

      // Calculate safe spawn position at Chunk (0,0) center: X=8, Z=8
      const spawnX = 8;
      const spawnZ = 8;
      const groundY = this.currentHeights[spawnZ * 48 + spawnX];
      const spawnY = groundY + 1;
      this.spawnCoords = { x: spawnX, y: spawnY, z: spawnZ };

      if (this.elevationElem) {
        this.elevationElem.textContent = `Spawn: X: ${spawnX}, Y: ${spawnY}, Z: ${spawnZ}`;
      }

      // Position spawn marker
      this.markerGroup.position.set(spawnX + 0.5, spawnY + 1.4, spawnZ + 0.5);

      // Rebuild both Voxel and Solid geometries
      this.buildVoxelMeshes();
      this.buildSolidMesh();
    }

    buildVoxelMeshes() {
      // Clear previous voxel meshes
      while (this.voxelGroup.children.length > 0) {
        const child = this.voxelGroup.children[0];
        this.voxelGroup.remove(child);
        if (child.dispose) child.dispose();
      }

      const dummy = new THREE.Object3D();
      const baseY = 58;

      // Lists to collect instance matrices
      const grassMatrices = [];
      const dirtMatrices = [];
      const stoneMatrices = [];
      const bedrockMatrices = [];
      const waterMatrices = [];

      for (let z = 0; z < 48; z++) {
        for (let x = 0; x < 48; x++) {
          const h = this.currentHeights[z * 48 + x];
          const isPerimeter = (x === 0 || x === 47 || z === 0 || z === 47);

          // 1. Bedrock base at baseY
          dummy.position.set(x + 0.5, baseY + 0.5, z + 0.5);
          dummy.updateMatrix();
          bedrockMatrices.push(dummy.matrix.clone());

          // 2. Stone: on perimeter skirts down to baseY
          if (isPerimeter) {
            const stoneTop = Math.max(baseY + 1, h - 4);
            for (let y = baseY + 1; y <= stoneTop; y++) {
              dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
              dummy.updateMatrix();
              stoneMatrices.push(dummy.matrix.clone());
            }
          }

          // 3. Dirt: 3 subsurface layers (or down to baseY+1)
          const dirtBottom = Math.max(baseY + 1, h - 3);
          for (let y = dirtBottom; y < h; y++) {
            dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
            dummy.updateMatrix();
            dirtMatrices.push(dummy.matrix.clone());
          }

          // 4. Top Surface: Grass (if h >= 63) or Dirt (if underwater/depression)
          if (h >= 63) {
            dummy.position.set(x + 0.5, h + 0.5, z + 0.5);
            dummy.updateMatrix();
            grassMatrices.push(dummy.matrix.clone());
          } else {
            dummy.position.set(x + 0.5, h + 0.5, z + 0.5);
            dummy.updateMatrix();
            dirtMatrices.push(dummy.matrix.clone());
          }

          // 5. Water layer if h < 62
          if (h < 62) {
            for (let y = h + 1; y <= 62; y++) {
              dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
              dummy.updateMatrix();
              waterMatrices.push(dummy.matrix.clone());
            }
          }
        }
      }

      // Helper to instantiate InstancedMesh
      const createInstancedMesh = (geo, mat, matrixList) => {
        if (!matrixList.length) return null;
        const imesh = new THREE.InstancedMesh(geo, mat, matrixList.length);
        for (let i = 0; i < matrixList.length; i++) {
          imesh.setMatrixAt(i, matrixList[i]);
        }
        imesh.instanceMatrix.needsUpdate = true;
        return imesh;
      };

      const grassMesh = createInstancedMesh(this.boxGeo, this.materials.grass, grassMatrices);
      const dirtMesh = createInstancedMesh(this.boxGeo, this.materials.dirt, dirtMatrices);
      const stoneMesh = createInstancedMesh(this.boxGeo, this.materials.stone, stoneMatrices);
      const bedrockMesh = createInstancedMesh(this.boxGeo, this.materials.bedrock, bedrockMatrices);
      const waterMesh = createInstancedMesh(this.boxGeo, this.materials.water, waterMatrices);

      if (bedrockMesh) this.voxelGroup.add(bedrockMesh);
      if (stoneMesh) this.voxelGroup.add(stoneMesh);
      if (dirtMesh) this.voxelGroup.add(dirtMesh);
      if (grassMesh) this.voxelGroup.add(grassMesh);
      if (waterMesh) this.voxelGroup.add(waterMesh);
    }

    buildSolidMesh() {
      // Clear previous solid meshes
      while (this.solidGroup.children.length > 0) {
        const child = this.solidGroup.children[0];
        this.solidGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
      }

      const baseY = 58;
      const positions = [];
      const colors = [];
      const indices = [];

      const colGrass = new THREE.Color(0x5B8C32);
      const colDirt = new THREE.Color(0x866043);
      const colStone = new THREE.Color(0x6E6E6E);

      // 1. Terrain Surface Grid
      for (let z = 0; z < 48; z++) {
        for (let x = 0; x < 48; x++) {
          const h = this.currentHeights[z * 48 + x];
          positions.push(x + 0.5, h + 1.0, z + 0.5);
          const c = (h >= 63) ? colGrass : colDirt;
          colors.push(c.r, c.g, c.b);
        }
      }

      for (let z = 0; z < 47; z++) {
        for (let x = 0; x < 47; x++) {
          const a = z * 48 + x;
          const b = z * 48 + (x + 1);
          const c = (z + 1) * 48 + x;
          const d = (z + 1) * 48 + (x + 1);

          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }

      const surfaceGeo = new THREE.BufferGeometry();
      surfaceGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      surfaceGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      surfaceGeo.setIndex(indices);
      surfaceGeo.computeVertexNormals();

      const surfaceMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        roughness: 0.8
      });
      const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
      this.solidGroup.add(surfaceMesh);

      // 2. Skirt walls along 4 borders down to baseY
      const skirtPos = [];
      const skirtCol = [];
      const skirtIndices = [];
      let skirtVCount = 0;

      const addWallQuad = (p1, p2, p3, p4, color) => {
        skirtPos.push(...p1, ...p2, ...p3, ...p4);
        skirtCol.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
        skirtIndices.push(skirtVCount, skirtVCount + 1, skirtVCount + 2);
        skirtIndices.push(skirtVCount, skirtVCount + 2, skirtVCount + 3);
        skirtVCount += 4;
      };

      // North wall (z = 0)
      for (let x = 0; x < 47; x++) {
        const h1 = this.currentHeights[0 * 48 + x] + 1;
        const h2 = this.currentHeights[0 * 48 + (x + 1)] + 1;
        addWallQuad(
          [x + 0.5, h1, 0.5],
          [x + 1.5, h2, 0.5],
          [x + 1.5, baseY, 0.5],
          [x + 0.5, baseY, 0.5],
          colStone
        );
      }
      // South wall (z = 47)
      for (let x = 0; x < 47; x++) {
        const h1 = this.currentHeights[47 * 48 + x] + 1;
        const h2 = this.currentHeights[47 * 48 + (x + 1)] + 1;
        addWallQuad(
          [x + 1.5, h2, 47.5],
          [x + 0.5, h1, 47.5],
          [x + 0.5, baseY, 47.5],
          [x + 1.5, baseY, 47.5],
          colStone
        );
      }
      // West wall (x = 0)
      for (let z = 0; z < 47; z++) {
        const h1 = this.currentHeights[z * 48 + 0] + 1;
        const h2 = this.currentHeights[(z + 1) * 48 + 0] + 1;
        addWallQuad(
          [0.5, h2, z + 1.5],
          [0.5, h1, z + 0.5],
          [0.5, baseY, z + 0.5],
          [0.5, baseY, z + 1.5],
          colStone
        );
      }
      // East wall (x = 47)
      for (let z = 0; z < 47; z++) {
        const h1 = this.currentHeights[z * 48 + 47] + 1;
        const h2 = this.currentHeights[(z + 1) * 48 + 47] + 1;
        addWallQuad(
          [47.5, h1, z + 0.5],
          [47.5, h2, z + 1.5],
          [47.5, baseY, z + 1.5],
          [47.5, baseY, z + 0.5],
          colStone
        );
      }

      if (skirtPos.length > 0) {
        const skirtGeo = new THREE.BufferGeometry();
        skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
        skirtGeo.setAttribute('color', new THREE.Float32BufferAttribute(skirtCol, 3));
        skirtGeo.setIndex(skirtIndices);
        skirtGeo.computeVertexNormals();

        const skirtMat = new THREE.MeshLambertMaterial({
          vertexColors: true,
          side: THREE.DoubleSide
        });
        const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
        this.solidGroup.add(skirtMesh);
      }

      // 3. Bedrock bottom plane at baseY
      const baseGeo = new THREE.PlaneGeometry(47, 47);
      baseGeo.rotateX(Math.PI / 2);
      baseGeo.translate(23.5, baseY, 23.5);
      const baseMesh = new THREE.Mesh(baseGeo, this.materials.bedrock);
      this.solidGroup.add(baseMesh);

      // 4. Transparent water surface plane at Y = 62.2
      const waterPlaneGeo = new THREE.PlaneGeometry(47, 47);
      waterPlaneGeo.rotateX(-Math.PI / 2);
      waterPlaneGeo.translate(23.5, 62.2, 23.5);
      const waterPlaneMesh = new THREE.Mesh(waterPlaneGeo, this.materials.water);
      this.solidGroup.add(waterPlaneMesh);
    }

    animate() {
      requestAnimationFrame(() => this.animate());

      const time = performance.now() * 0.001;

      // Animate spawn marker diamond: gentle rotation and bobbing
      if (this.markerDiamond) {
        this.markerDiamond.rotation.y += 0.03;
        this.markerDiamond.rotation.x = Math.sin(time * 2) * 0.15;
        this.markerDiamond.position.y = Math.sin(time * 3.5) * 0.18;
      }

      if (this.controls) {
        this.controls.update();
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TerrainViewer3D };
  } else {
    root.TerrainViewer3D = TerrainViewer3D;
  }
})(typeof window !== 'undefined' ? window : globalThis);
