/**
 * 2D Biome Map Viewer (Chunkbase / Cubiomes Style)
 * ------------------------------------------------
 * Interactive HTML5 Canvas Map Viewer powered by pure JS Cubiomes GenLayer engine.
 * Features:
 * - Real-time pan & zoom with crisp pixel-art rendering
 * - Authentic Minecraft Java 1.16 biomes & structure locating
 * - Dimension switching: Overworld & The Nether
 * - Chunkbase-style Structure Feature Icons with sprite sheet
 * - Block, Chunk, Biome, and Distance from spawn indicator
 * - Structure hover hit-testing & highlight tooltip
 */

(function (root) {
  'use strict';

  class BiomeMap2D {
    constructor(canvas, generator, structureFinder) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.generator = generator;
      this.structureFinder = structureFinder;

      // Dimension state ('overworld' | 'nether')
      this.dimension = 'overworld';

      // Map Viewport state (in block coordinates)
      this.centerX = 8; // default spawn X
      this.centerZ = 8; // default spawn Z
      this.spawnX = 8;
      this.spawnZ = 8;
      this.zoom = 1.0;  // 1 screen pixel = 1 / zoom blocks
      this.minZoom = 0.15;
      this.maxZoom = 8.0;

      // Settings
      this.showGrid = true;
      this.showSpawn = true;
      this.showStructures = true;

      // Enabled structure types (all enabled by default)
      this.enabledStructures = new Set([
        // Overworld
        'village',
        'desert_pyramid',
        'jungle_temple',
        'swamp_hut',
        'pillager_outpost',
        'ocean_monument',
        'woodland_mansion',
        'shipwreck',
        'ruined_portal',
        'stronghold',
        'slime_chunk',
        'mineshaft',
        // Nether
        'fortress',
        'bastion',
        'ruined_portal_n',
        'nether_fossil'
      ]);

      // Sprite sheet for features / structures (assets/icons/features.webp: 242x88)
      this.spriteSheet = new Image();
      this.spriteSheetLoaded = false;
      this.spriteSheet.onload = () => {
        this.spriteSheetLoaded = true;
        this.render();
      };
      this.spriteSheet.src = 'assets/icons/features.webp';

      // Mouse drag state
      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.dragStartCenterX = 0;
      this.dragStartCenterZ = 0;

      // Hover state
      this.hoverBlockX = 8;
      this.hoverBlockZ = 8;
      this.hoverBiomeId = 0;
      this.hoveredStructure = null;
      this.onHoverCallback = null;

      // Offscreen buffer for fast rendering
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');

      // Cached structures currently visible on screen
      this.visibleStructures = [];

      this.bindEvents();
      this.resize();
    }

    setGenerator(generator) {
      this.generator = generator;
      this.render();
    }

    setStructureFinder(finder) {
      this.structureFinder = finder;
      this.render();
    }

    setDimension(dim, generator) {
      this.dimension = dim;
      if (generator) {
        this.generator = generator;
      }
      this.render();
    }

    setCenter(bx, bz) {
      this.centerX = Math.round(bx);
      this.centerZ = Math.round(bz);
      this.render();
    }

    goToCoordinates(x, z) {
      this.setCenter(x, z);
    }

    setZoom(newZoom) {
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
      this.render();
    }

    onHover(callback) {
      this.onHoverCallback = callback;
    }

    toggleGrid(enabled) {
      this.showGrid = enabled !== undefined ? enabled : !this.showGrid;
      this.render();
      return this.showGrid;
    }

    toggleStructureType(typeKey, enabled) {
      if (enabled === undefined) {
        if (this.enabledStructures.has(typeKey)) {
          this.enabledStructures.delete(typeKey);
        } else {
          this.enabledStructures.add(typeKey);
        }
      } else if (enabled) {
        this.enabledStructures.add(typeKey);
      } else {
        this.enabledStructures.delete(typeKey);
      }
      this.render();
      return this.enabledStructures.has(typeKey);
    }

    setAllStructuresEnabled(enabled) {
      if (enabled) {
        const types = [
          'village', 'desert_pyramid', 'jungle_temple', 'swamp_hut', 'pillager_outpost',
          'ocean_monument', 'woodland_mansion', 'shipwreck', 'ruined_portal', 'stronghold',
          'slime_chunk', 'mineshaft', 'fortress', 'bastion', 'ruined_portal_n', 'nether_fossil'
        ];
        types.forEach(t => this.enabledStructures.add(t));
      } else {
        this.enabledStructures.clear();
      }
      this.render();
    }

    resize() {
      const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : null;
      const width = rect && rect.width > 50 ? Math.floor(rect.width) : 600;
      const height = rect && rect.height > 50 ? Math.floor(rect.height) : 340;

      this.canvas.width = width;
      this.canvas.height = height;
      this.render();
    }

    /**
     * Converts screen pixel coordinate to Minecraft block coordinate.
     */
    screenToBlock(sx, sy) {
      const halfW = this.canvas.width / 2;
      const halfH = this.canvas.height / 2;
      const bx = Math.round(this.centerX + (sx - halfW) / this.zoom);
      const bz = Math.round(this.centerZ + (sy - halfH) / this.zoom);
      return { bx, bz };
    }

    /**
     * Converts Minecraft block coordinate to screen pixel coordinate.
     */
    blockToScreen(bx, bz) {
      const halfW = this.canvas.width / 2;
      const halfH = this.canvas.height / 2;
      const sx = halfW + (bx - this.centerX) * this.zoom;
      const sy = halfH + (bz - this.centerZ) * this.zoom;
      return { sx, sy };
    }

    /**
     * Main Render Loop
     */
    render() {
      if (!this.generator || !this.ctx) return;

      const cw = this.canvas.width;
      const ch = this.canvas.height;
      if (cw === 0 || ch === 0) return;

      const halfW = cw / 2;
      const halfH = ch / 2;

      // Determine sample grid bounds in 1:4 scale (quart coordinates)
      const minBlockX = this.centerX - halfW / this.zoom;
      const maxBlockX = this.centerX + halfW / this.zoom;
      const minBlockZ = this.centerZ - halfH / this.zoom;
      const maxBlockZ = this.centerZ + halfH / this.zoom;

      const qStartX = Math.floor(minBlockX / 4) - 1;
      const qStartZ = Math.floor(minBlockZ / 4) - 1;
      const qEndX = Math.ceil(maxBlockX / 4) + 1;
      const qEndZ = Math.ceil(maxBlockZ / 4) + 1;

      const qWidth = qEndX - qStartX + 1;
      const qHeight = qEndZ - qStartZ + 1;

      if (qWidth <= 0 || qHeight <= 0) return;

      // Query biomes from pure JS engine
      const biomes = this.generator.getBiomes(qStartX, qStartZ, qWidth, qHeight);

      // Render to offscreen canvas
      this.offscreenCanvas.width = qWidth;
      this.offscreenCanvas.height = qHeight;
      const imgData = this.offscreenCtx.createImageData(qWidth, qHeight);
      const data32 = new Uint32Array(imgData.data.buffer);

      const BiomeHelpers = (typeof CubiomesBiomes !== 'undefined' ? CubiomesBiomes : (window.CubiomesBiomes || {}));
      const getBiomeColor = BiomeHelpers.getBiomeColor || (() => 0x555555);

      // Cache color to 0xAABBGGRR
      const colorCache = {};

      for (let i = 0; i < qWidth * qHeight; i++) {
        const id = biomes[i];
        let colorInt = colorCache[id];
        if (colorInt === undefined) {
          let raw = getBiomeColor(id);
          // Nether biomes fallback if not in CubiomesBiomes
          if (this.dimension === 'nether' && this.generator.getBiomeMeta) {
            const m = this.generator.getBiomeMeta(id);
            if (m && m.color) raw = m.color;
          }
          let r = 0x55, g = 0x55, b = 0x55;
          if (typeof raw === 'number') {
            r = (raw >> 16) & 0xFF;
            g = (raw >> 8) & 0xFF;
            b = raw & 0xFF;
          } else if (typeof raw === 'string') {
            const hex = raw.replace('#', '');
            r = parseInt(hex.substring(0, 2), 16) || 0;
            g = parseInt(hex.substring(2, 4), 16) || 0;
            b = parseInt(hex.substring(4, 6), 16) || 0;
          }
          colorInt = (255 << 24) | (b << 16) | (g << 8) | r;
          colorCache[id] = colorInt;
        }
        data32[i] = colorInt;
      }

      this.offscreenCtx.putImageData(imgData, 0, 0);

      // Disable smoothing for sharp pixel-art Minecraft look
      this.ctx.imageSmoothingEnabled = false;

      // Calculate where (qStartX, qStartZ) lands on the main canvas
      const startScreenPos = this.blockToScreen(qStartX * 4, qStartZ * 4);
      const drawW = qWidth * 4 * this.zoom;
      const drawH = qHeight * 4 * this.zoom;

      this.ctx.fillStyle = this.dimension === 'nether' ? '#180404' : '#0a0a0c';
      this.ctx.fillRect(0, 0, cw, ch);

      this.ctx.drawImage(
        this.offscreenCanvas,
        startScreenPos.sx,
        startScreenPos.sy,
        drawW,
        drawH
      );

      // Draw Grid (Chunk lines = 16 blocks)
      if (this.showGrid && this.zoom >= 0.4) {
        this.drawChunkGrid(minBlockX, maxBlockX, minBlockZ, maxBlockZ);
      }

      // Draw Coordinates Axes & Ticks
      this.drawAxes(minBlockX, maxBlockX, minBlockZ, maxBlockZ);

      // Draw Spawn Point Marker (Overworld only)
      if (this.showSpawn && this.dimension === 'overworld') {
        this.drawSpawnMarker();
      }

      // Draw Structures (Chunkbase Feature Icons)
      if (this.showStructures && this.structureFinder) {
        this.drawStructures(minBlockX, minBlockZ, maxBlockX, maxBlockZ);
      }

      // Draw Cardinal Directions (North / South / East / West)
      this.drawCompassIndicator();

      // Draw Active Hovered Structure Tooltip
      if (this.hoveredStructure) {
        this.drawStructureTooltip(this.hoveredStructure);
      }
    }

    /**
     * Draw subtle chunk grid (every 16 blocks)
     */
    drawChunkGrid(minX, maxX, minZ, maxZ) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      this.ctx.lineWidth = 1;

      const firstChunkX = Math.floor(minX / 16) * 16;
      const lastChunkX = Math.ceil(maxX / 16) * 16;
      const firstChunkZ = Math.floor(minZ / 16) * 16;
      const lastChunkZ = Math.ceil(maxZ / 16) * 16;

      this.ctx.beginPath();
      for (let bx = firstChunkX; bx <= lastChunkX; bx += 16) {
        const { sx } = this.blockToScreen(bx, 0);
        this.ctx.moveTo(Math.floor(sx) + 0.5, 0);
        this.ctx.lineTo(Math.floor(sx) + 0.5, this.canvas.height);
      }
      for (let bz = firstChunkZ; bz <= lastChunkZ; bz += 16) {
        const { sy } = this.blockToScreen(0, bz);
        this.ctx.moveTo(0, Math.floor(sy) + 0.5);
        this.ctx.lineTo(this.canvas.width, Math.floor(sy) + 0.5);
      }
      this.ctx.stroke();

      // Highlight Region boundary (every 512 blocks) if zoomed out
      if (this.zoom < 1.0) {
        this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.25)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        const firstRegX = Math.floor(minX / 512) * 512;
        const lastRegX = Math.ceil(maxX / 512) * 512;
        const firstRegZ = Math.floor(minZ / 512) * 512;
        const lastRegZ = Math.ceil(maxZ / 512) * 512;

        for (let rx = firstRegX; rx <= lastRegX; rx += 512) {
          const { sx } = this.blockToScreen(rx, 0);
          this.ctx.moveTo(Math.floor(sx) + 0.5, 0);
          this.ctx.lineTo(Math.floor(sx) + 0.5, this.canvas.height);
        }
        for (let rz = firstRegZ; rz <= lastRegZ; rz += 512) {
          const { sy } = this.blockToScreen(0, rz);
          this.ctx.moveTo(0, Math.floor(sy) + 0.5);
          this.ctx.lineTo(this.canvas.width, Math.floor(sy) + 0.5);
        }
        this.ctx.stroke();
      }

      this.ctx.restore();
    }

    /**
     * Draw Minecraft Coordinates Axes (X = Red, Z = Blue)
     */
    drawAxes(minX, maxX, minZ, maxZ) {
      this.ctx.save();
      // Axis X = 0 (Vertical line)
      if (minX <= 0 && maxX >= 0) {
        const { sx } = this.blockToScreen(0, 0);
        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'; // Blue for Z axis line
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(Math.floor(sx) + 0.5, 0);
        this.ctx.lineTo(Math.floor(sx) + 0.5, this.canvas.height);
        this.ctx.stroke();
      }

      // Axis Z = 0 (Horizontal line)
      if (minZ <= 0 && maxZ >= 0) {
        const { sy } = this.blockToScreen(0, 0);
        this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; // Red for X axis line
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, Math.floor(sy) + 0.5);
        this.ctx.lineTo(this.canvas.width, Math.floor(sy) + 0.5);
        this.ctx.stroke();
      }

      this.ctx.restore();
    }

    /**
     * Draw Spawn Point crosshair & icon
     */
    drawSpawnMarker() {
      const { sx, sy } = this.blockToScreen(this.spawnX, this.spawnZ);
      if (sx < -20 || sx > this.canvas.width + 20 || sy < -20 || sy > this.canvas.height + 20) {
        return;
      }

      this.ctx.save();
      // Outer glow circle
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      this.ctx.fill();

      // Inner dot
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fill();
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.stroke();

      // Label
      this.ctx.font = 'bold 10px "Minecraft", monospace';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#000000';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(`Spawn (${this.spawnX}, ${this.spawnZ})`, sx + 10, sy - 4);

      this.ctx.restore();
    }

    /**
     * Draw Structure Feature Icons using Sprite Sheet
     */
    drawStructures(minX, minZ, maxX, maxZ) {
      if (!this.structureFinder) return;

      const buffer = 64; // expand bounds slightly
      const list = this.structureFinder.getStructuresInArea(
        this.dimension,
        minX - buffer,
        minZ - buffer,
        maxX + buffer,
        maxZ + buffer,
        this.enabledStructures,
        this.generator
      );

      this.visibleStructures = list;

      this.ctx.save();

      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const screen = this.blockToScreen(s.x, s.z);
        const sx = Math.round(screen.sx);
        const sy = Math.round(screen.sy);

        // Check if on canvas
        if (sx < -30 || sx > this.canvas.width + 30 || sy < -30 || sy > this.canvas.height + 30) {
          continue;
        }

        const isHovered = (this.hoveredStructure && this.hoveredStructure.id === s.id);
        const iconSize = isHovered ? 26 : 22;
        const halfSize = iconSize / 2;

        // Background badge behind icon for readability
        this.ctx.fillStyle = isHovered ? 'rgba(255, 215, 0, 0.9)' : 'rgba(15, 15, 20, 0.75)';
        this.ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1.5;

        this.ctx.beginPath();
        this.ctx.arc(sx, sy, halfSize + 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw Sprite Icon
        if (this.spriteSheetLoaded && s.icon) {
          this.ctx.drawImage(
            this.spriteSheet,
            s.icon.sx,
            s.icon.sy,
            s.icon.sw,
            s.icon.sh,
            sx - halfSize,
            sy - halfSize,
            iconSize,
            iconSize
          );
        } else {
          // Fallback colored pin
          this.ctx.fillStyle = '#f59e0b';
          this.ctx.beginPath();
          this.ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      this.ctx.restore();
    }

    /**
     * Draw Tooltip overlay when hovering over a structure icon
     */
    drawStructureTooltip(s) {
      const screen = this.blockToScreen(s.x, s.z);
      const sx = screen.sx;
      const sy = screen.sy - 24;

      this.ctx.save();
      const dist = Math.round(Math.hypot(s.x - this.spawnX, s.z - this.spawnZ));
      const title = s.name;
      const subtitle = `X: ${s.x}, Z: ${s.z} • Dist: ${dist}m`;

      this.ctx.font = 'bold 11px "Minecraft", monospace';
      const w1 = this.ctx.measureText(title).width;
      this.ctx.font = '9px "Minecraft", monospace';
      const w2 = this.ctx.measureText(subtitle).width;
      const boxW = Math.max(w1, w2) + 16;
      const boxH = 34;

      let boxX = sx - boxW / 2;
      let boxY = sy - boxH;

      // Keep within canvas bounds
      if (boxX < 10) boxX = 10;
      if (boxX + boxW > this.canvas.width - 10) boxX = this.canvas.width - 10 - boxW;
      if (boxY < 10) boxY = sy + 36;

      // Box background
      this.ctx.fillStyle = 'rgba(10, 10, 14, 0.95)';
      this.ctx.strokeStyle = '#55ff55';
      this.ctx.lineWidth = 1.5;
      this.ctx.fillRect(boxX, boxY, boxW, boxH);
      this.ctx.strokeRect(boxX, boxY, boxW, boxH);

      // Title
      this.ctx.font = 'bold 11px "Minecraft", monospace';
      this.ctx.fillStyle = '#ffff55';
      this.ctx.fillText(title, boxX + 8, boxY + 14);

      // Subtitle
      this.ctx.font = '9px "Minecraft", monospace';
      this.ctx.fillStyle = '#aaaaaa';
      this.ctx.fillText(subtitle, boxX + 8, boxY + 28);

      this.ctx.restore();
    }

    /**
     * Draw Minimal Compass HUD in Top-Right
     */
    drawCompassIndicator() {
      const x = this.canvas.width - 32;
      const y = 32;

      this.ctx.save();
      // Outer dial
      this.ctx.beginPath();
      this.ctx.arc(x, y, 16, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // North needle (pointing up / -Z)
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - 12);
      this.ctx.lineTo(x - 3.5, y);
      this.ctx.lineTo(x + 3.5, y);
      this.ctx.closePath();
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fill();

      // South needle (pointing down / +Z)
      this.ctx.beginPath();
      this.ctx.moveTo(x, y + 12);
      this.ctx.lineTo(x - 3.5, y);
      this.ctx.lineTo(x + 3.5, y);
      this.ctx.closePath();
      this.ctx.fillStyle = '#6b7280';
      this.ctx.fill();

      // Center dot
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();

      // Labels
      this.ctx.font = 'bold 8px "Minecraft", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fillText('N', x, y - 13);

      this.ctx.restore();
    }

    /**
     * Bind UI event listeners (Pan, Drag, Zoom, Tooltip)
     */
    bindEvents() {
      window.addEventListener('resize', () => this.resize());

      // Mouse Drag for Panning
      this.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 || e.button === 1 || e.button === 2) {
          this.isDragging = true;
          this.dragStartX = e.clientX;
          this.dragStartY = e.clientY;
          this.dragStartCenterX = this.centerX;
          this.dragStartCenterZ = this.centerZ;
          this.canvas.style.cursor = 'grabbing';
          e.preventDefault();
        }
      });

      window.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (this.isDragging) {
          const dx = (e.clientX - this.dragStartX) / this.zoom;
          const dz = (e.clientY - this.dragStartY) / this.zoom;
          this.centerX = Math.round(this.dragStartCenterX - dx);
          this.centerZ = Math.round(this.dragStartCenterZ - dz);
          this.render();
        }

        // Inside canvas bounds
        if (sx >= 0 && sx <= this.canvas.width && sy >= 0 && sy <= this.canvas.height) {
          const { bx, bz } = this.screenToBlock(sx, sy);
          this.hoverBlockX = bx;
          this.hoverBlockZ = bz;

          // Hit-test structure icons (radius <= 14px)
          let nearestStruct = null;
          let nearestDist = 15;
          for (let i = 0; i < this.visibleStructures.length; i++) {
            const st = this.visibleStructures[i];
            const spos = this.blockToScreen(st.x, st.z);
            const d = Math.hypot(spos.sx - sx, spos.sy - sy);
            if (d < nearestDist) {
              nearestDist = d;
              nearestStruct = st;
            }
          }

          const structChanged = (this.hoveredStructure !== nearestStruct);
          this.hoveredStructure = nearestStruct;

          if (structChanged) {
            this.render();
          }

          if (this.generator) {
            this.hoverBiomeId = this.generator.getBiomeAtBlock(bx, bz);
            if (this.onHoverCallback) {
              const meta = this.generator.getBiomeMeta(this.hoverBiomeId);
              const distFromSpawn = Math.round(Math.hypot(bx - this.spawnX, bz - this.spawnZ));
              this.onHoverCallback({
                bx,
                bz,
                chunkX: Math.floor(bx / 16),
                chunkZ: Math.floor(bz / 16),
                biomeId: this.hoverBiomeId,
                biomeName: meta.name,
                biomeColor: meta.color,
                distanceFromSpawn: distFromSpawn,
                hoveredStructure: this.hoveredStructure
              });
            }
          }
        }
      });

      window.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.isDragging = false;
          this.canvas.style.cursor = 'crosshair';
        }
      });

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      // Mouse Wheel Zoom
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseSx = e.clientX - rect.left;
        const mouseSy = e.clientY - rect.top;

        // Block position before zoom
        const { bx: targetBx, bz: targetBz } = this.screenToBlock(mouseSx, mouseSy);

        const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
        const targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

        if (targetZoom !== this.zoom) {
          this.zoom = targetZoom;
          // Adjust center so mouse cursor stays on the same block
          const halfW = this.canvas.width / 2;
          const halfH = this.canvas.height / 2;
          this.centerX = Math.round(targetBx - (mouseSx - halfW) / this.zoom);
          this.centerZ = Math.round(targetBz - (mouseSy - halfH) / this.zoom);
          this.render();
        }
      }, { passive: false });
    }
  }

  root.BiomeMap2D = BiomeMap2D;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BiomeMap2D };
  }
})(typeof window !== 'undefined' ? window : globalThis);
