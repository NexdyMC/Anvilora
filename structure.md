# 🗺️ Dokumentasi Struktur Kerangka Proyek (Architecture & File Structure)

Dokumen ini merupakan panduan arsitektur modular untuk proyek **Minecraft 1.16.1 Instant World Save Generator**. Pemisahan kode dari file monolitik `app.js` ke dalam modul-modul terpisah bertujuan untuk meningkatkan kerapian, kemudahan *maintenance*, pemisahan tanggung jawab (*Separation of Concerns*), serta memudahkan kolaborasi pengembangan di masa mendatang.

---

## 📂 Pohon Struktur File & Direktori

```text
WorldGenerator/
├── index.html                   (Halaman utama antarmuka pengguna)
├── style.css                    (Gaya tampilan Minecraft UI otentik & responsif)
├── app.js                       (Main Orchestrator / Jembatan antara UI & Generator)
├── structure.md                 (Dokumentasi kerangka file & modul)
├── readme.md                    (Dokumentasi umum & spesifikasi proyek)
│
├── assets/                      [ASET VISUAL & MEDIA]
│   ├── images/
│   │   └── wallpaper.jpg        (Pixel art twilight & cherry blossom background)
│   └── icons/
│       └── features.webp        (Icon pratinjau fitur)
│
├── fonts/                       [ASET TIPOGRAFI LOKAL]
│   └── Minecraft.otf            (Font pixel otentik Minecraft Java Edition)
│
└── js/
    ├── libs/                    [PUSTAKA EKSTERNAL OFFLINE]
    │   ├── pako.min.js          (Zlib / GZIP compression library)
    │   ├── jszip.min.js         (Client-side ZIP archive bundler)
    │   ├── three.min.js         (3D WebGL render engine)
    │   └── OrbitControls.js     (Three.js interactive mouse controls)
    │
    ├── core/                    [FONDASI BINER MINECRAFT]
    │   ├── nbt.js               (Class NBTWriter & penyusun berkas level.dat)
    │   ├── anvil.js             (Class RegionWriter: penyusun header 8KB & berkas r.0.0.mca)
    │   └── seed.js              (Parser seed 64-bit BigInt & Java String.hashCode)
    │
    ├── generator/               [MATEMATIKA & WORLDGEN]
    │   ├── noise.js             (JavaRandom LCG & Multi-Octave PerlinNoise2D)
    │   ├── terrain.js           (RollingPlainsTerrain: kalkulasi bukit Y=62..72 & safe spawn)
    │   └── chunk.js             (Penyusun blok section: bedrock, stone, dirt, grass, water)
    │
    └── viewer/                  [TEMPAT FITUR PREVIEW 3D]
        └── terrain3d.js         (Renderer 3D Three.js & OrbitControls)
```

---

## 🧩 Rincian Tugas & Tanggung Jawab Setiap File

### 1. Root Directory

| File | Deskripsi & Tanggung Jawab |
| :--- | :--- |
| **`index.html`** | Menjadi kerangka utama halaman web. Memuat elemen form Create New World, kontainer kanvas WebGL 3D, kartu instruksi pemasangan save, serta mengimpor pustaka eksternal (Pako, JSZip, Three.js, OrbitControls) dan seluruh berkas skrip modular `js/`. |
| **`style.css`** | Mengatur seluruh tampilan visual retro-modern Minecraft: background dirt berpola dengan vignette gelap, tombol 3D beveled khas dengan efek `:hover` kuning dan `:active` tertekan, frame WebGL 3D, serta layout responsif (desktop, tablet, mobile). |
| **`app.js`** | Bertindak sebagai **Main Orchestrator**. Mengelola state antarmuka (Game Mode, Difficulty, Cheats, Structures, Terrain Mode), menangani event listener form dan tombol download, memanggil modul-modul generator, mengompresi data dengan Pako & JSZip, serta mengeksekusi pengunduhan file `.zip`. |

---

### 2. Direktori `fonts/` (Aset Tipografi Lokal)

* **`fonts/Minecraft.otf`**: Berkas font OpenType otentik Minecraft Java Edition yang dimuat secara lokal melalui aturan `@font-face` di `style.css` agar tampilan tipografi 100% identik dengan menu game asli tanpa perlu ketergantungan koneksi ke Google Fonts.

---

### 3. Direktori `js/libs/` (Pustaka Eksternal Offline)

Menyimpan semua library eksternal secara lokal di folder proyek tanpa bergantung pada CDN internet:

* **`js/libs/pako.min.js`**: Engine kompresi biner ZLIB / GZIP (Deflate).
* **`js/libs/jszip.min.js`**: Bundler arsip berkas `.zip` di sisi peramban (*client-side*).
* **`js/libs/three.min.js`**: Pustaka 3D WebGL untuk merender model voxel dunia Minecraft.
* **`js/libs/OrbitControls.js`**: Kontrol kamera mouse interaktif 360° untuk Three.js.

---

### 4. Direktori `js/core/` (Fondasi Biner Minecraft)

Modul-modul pada folder ini menangani spesifikasi biner standar Minecraft Java Edition secara presisi:

* **`js/core/nbt.js`**
  * Berisi konstanta `NBT_TAGS` (TAG_End hingga TAG_Long_Array).
  * Kelas `NBTWriter`: Menulis data biner Big-Endian murni ke `Uint8Array` (byte, short, int, long 64-bit BigInt, float, double, string UTF-8, list berindeks, compound, array integer, array long).
  * Fungsi `buildLevelDatBytes(options)`: Menyusun hirarki data `level.dat` valid untuk Minecraft 1.16.1 (`DataVersion: 2567`, Compound `Version`, `WorldGenSettings`, koordinat spawn, dll.).

* **`js/core/anvil.js`**
  * Berisi fungsi/kelas `buildRegionMca(chunks)`: Menyusun format arsip region `.mca` (Anvil Save Format).
  * Menghasilkan tabel lokasi 4KB (1024 offset chunk 32x32), tabel timestamp 4KB, pemadatan data chunk terkompresi ZLIB (RFC 1950), dan *padding* sektor 4096 byte.

* **`js/core/seed.js`**
  * Berisi fungsi `parseMinecraftSeed(input)`:
    * Jika kosong: Mengenerate nilai acak 64-bit bertanda (*signed BigInt*).
    * Jika angka: Melakukan parsing ke integer 64-bit BigInt.
    * Jika teks: Mengonversi teks string menggunakan algoritma `String.hashCode()` standar Java.

---

### 3. Direktori `js/generator/` (Matematika & Worldgen)

Modul-modul pada folder ini bertanggung jawab atas prosedur pembentukan lanskap dan kalkulasi koordinat:

* **`js/generator/noise.js`**
  * Kelas `JavaRandom`: Generator bilangan acak Linear Congruential Generator (LCG) dengan perkalian `0x5DEECE66Dn` yang identik dengan Java Edition.
  * Kelas `PerlinNoise2D`: Algoritma Gradient Perlin Noise 2D (fade, lerp, grad, sample) dengan tabel permutasi 512 entri untuk menghasilkan kontur alam yang organik.

* **`js/generator/terrain.js`**
  * Kelas `RollingPlainsTerrain`: Mengombinasikan 3 oktaf Perlin noise (frekuensi rendah, menengah, dan mikro) untuk menghitung elevasi permukaan bukit yang dibatasi secara ketat antara $Y=62$ hingga $Y=72$.
  * Menghitung titik *safe spawn* pemain di atas blok rumput pada Chunk (0,0).

* **`js/generator/chunk.js`**
  * Berisi fungsi `buildTerrainChunkNbt(cx, cz, terrain, isFlat)`:
    * Menyusun struktur NBT tiap Chunk 16x16: Biomes (minecraft:plains), Heightmaps, dan Sections $Y=0$ hingga $Y=4$ ($Y=0$ s/d $79$).
    * Mengisi lapisan: Bedrock ($Y=0$), Stone ($Y=1$ hingga $H-4$), Dirt ($Y=H-3$ hingga $H-1$), Grass Block ($Y=H$), dan Water ($Y \le 62$).
    * Mengemas `Palette` dan bit-packing array `BlockStates` 64-bit sesuai spesifikasi Minecraft 1.16+.

---

### 4. Direktori `js/viewer/` (Fitur Preview 3D)

Modul ini memisahkan logika WebGL 3D agar independen dari logika form:

* **`js/viewer/terrain3d.js`**
  * Kelas `TerrainViewer3D`: Mengelola kanvas WebGL interaktif menggunakan pustaka **Three.js** dan **OrbitControls**.
  * **Voxel Mode**: Memanfaatkan `THREE.InstancedMesh` dengan satu geometri balok tunggal (`BoxGeometry`) untuk merender ~12.000 balok pada grid 48x48 (3x3 chunks) stabil pada 60 FPS tanpa lag.
  * **Solid Mode**: Merender mesh permukaan terpadu (`BufferGeometry`) dengan vertex coloring.
  * **Spawn Marker**: Menampilkan prisma emas berpendar (*glowing golden beacon*) dan target ring merah di titik spawn pemain.
  * Menangani fitur: Reset Kamera, Toggle Mode (Voxel / Solid), reaktivitas perubahan Seed real-time, dan adaptasi resize otomatis.

---

## 🔗 Urutan Pemuatan Skrip di `index.html`

Untuk memastikan seluruh dependensi dan objek global tersedia saat dibutuhkan, skrip dimuat dengan urutan berikut:

```html
<!-- 1. Pustaka Eksternal (CDN) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>

<!-- 2. Fondasi Biner Minecraft (Core) -->
<script src="js/core/seed.js"></script>
<script src="js/core/nbt.js"></script>
<script src="js/core/anvil.js"></script>

<!-- 3. Generator & Matematika (Generator) -->
<script src="js/generator/noise.js"></script>
<script src="js/generator/terrain.js"></script>
<script src="js/generator/chunk.js"></script>

<!-- 4. Preview WebGL 3D (Viewer) -->
<script src="js/viewer/terrain3d.js"></script>

<!-- 5. Main Orchestrator UI -->
<script src="app.js"></script>
```

---

## ✅ Manfaat Pemisahan Modular
1. **Readable & Maintainable**: Kode tidak lagi terkonsentrasi dalam 1.500+ baris di satu file; setiap berkas berukuran ramping (rata-rata 80–250 baris).
2. **Easy Debugging**: Jika ada masalah pada serialisasi biner, cukup buka `js/core/nbt.js`; jika ada perbaikan pada algoritma noise, cukup periksa `js/generator/noise.js`.
3. **No Build Step Required**: Tetap berjalan 100% di browser biasa tanpa memerlukan compiler kompleks (seperti Webpack/Vite), sehingga tetap kompatibel langsung di Netlify / GitHub Pages.
