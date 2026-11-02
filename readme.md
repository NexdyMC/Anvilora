# Anvilora — Minecraft 1.16.1 Instant World Save Generator (Web-Based)

# Description
Proyek ini adalah aplikasi web statis berbasis **HTML, CSS, dan JavaScript murni** yang memungkinkan pengguna menghasilkan dan mengunduh berkas dunia (*world save*) Minecraft Java Edition 1.16.1 dalam format `.zip`. 

Aplikasi ini bekerja 100% di sisi klien (*client-side*) di dalam browser tanpa memerlukan backend server atau instalasi Java. Dengan memanfaatkan pustaka manipulasi data biner (NBT Writer) dan kompresi (GZIP via Pako & JSZip), web ini langsung menyusun file `level.dat` yang valid dan membungkusnya ke dalam struktur folder dunia Minecraft yang siap dimainkan.

# Tujuan
* Memungkinkan pemain membuat dunia Minecraft baru hanya dengan memasukkan *seed* dan nama dunia lewat browser, lalu mengunduh hasilnya dalam bentuk `.zip`.
* Menghemat waktu pemain agar tidak perlu membuka game, masuk ke menu *"Create New World"*, menyalin *seed*, dan mengatur opsi dunia secara manual di dalam Minecraft.
* Pemain cukup mengekstrak file `.zip` ke folder `.minecraft/saves/`, dan dunia sudah langsung muncul di daftar menu *Singleplayer* dan siap dimainkan (*Play Selected World*).
* Berjalan sepenuhnya di layanan hosting statis gratisan seperti **Netlify**, GitHub Pages, atau Vercel tanpa beban komputasi server.

# Fitur yang telah diimplementasikan & yang akan datang
* [x] Integrasi tag `WorldGenSettings` lengkap untuk dimensi Overworld, Nether, dan The End (Minecraft 1.16.1 DataVersion 2567).
* [x] Generasi otomatis berkas region Overworld (`region/r.0.0.mca`) langsung di browser: pre-generate 9 spawn chunks ($3 \times 3$ chunk) dengan lapisan bedrock, stone, dirt, dan grass di $Y=64$.
* [x] Opsi toggle antarmuka antara *Pre-generated 3x3 (Flat Grass)* dan *Game Generated (Vanilla)*.
* [x] Kustomisasi mode permainan (*Survival*, *Hardcore*, *Creative*), *Difficulty*, *Allow Cheats*, dan *Generate Structures*.
* [ ] Pilihan tipe generator dunia tambahan (*Superflat*, *Large Biomes*, *Amplified*).
* [ ] Kustomisasi gamerules lanjutan langsung dari antarmuka web (misalnya `keepInventory`, `mobGriefing`, `doDaylightCycle`).
* [ ] Pilihan koordinat kustom untuk titik spawn pemain (`SpawnX`, `SpawnY`, `SpawnZ`).

# Cara penggunaan
1. Buka halaman website (`index.html`) di browser Anda.
2. Masukkan nama dunia yang diinginkan pada kolom **Nama Dunia**.
3. Masukkan angka atau teks pada kolom **Seed Minecraft** (jika dikosongkan, seed acak akan dibuat otomatis).
4. Pilih mode permainan (**Survival**, **Creative**, atau **Adventure**).
5. Klik tombol **"Generate & Download .ZIP"**.
6. Ekstrak folder hasil unduhan `.zip` ke direktori save game Minecraft:
   * **Windows:** Tekan `Win + R` $\rightarrow$ ketik `%appdata%\.minecraft\saves` $\rightarrow$ tekan `Enter`.
7. Buka game **Minecraft Java Edition 1.16.1**, masuk ke menu **Singleplayer**, dan dunia Anda sudah siap dimainkan.

# setup dan bahan bahan
Karena proyek ini berbasis web statis, tidak ada instalasi compiler rumit yang dibutuhkan di komputer:
* **HTML5 & CSS3:** Untuk tampilan antarmuka (UI).
* **JavaScript (ES6+):** Untuk pemrosesan logika pembentuk biner NBT.
* **JSZip (`cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`):** Pustaka untuk membungkus folder dan file menjadi file `.zip` langsung di browser.
* **Pako (`cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js`):** Pustaka untuk melakukan kompresi GZIP pada file `level.dat`.
* **Hosting:** Netlify (Free Tier) — cukup *drag and drop* folder proyek yang berisi `index.html`.

# Aturan
1. **Format NBT Wajib Valid:** Struktur NBT harus mengikuti hirarki Minecraft: `TAG_Compound("")` $\rightarrow$ `TAG_Compound("Data")` $\rightarrow$ tag-tag data dunia $\rightarrow$ ditutup `TAG_End (0x00)`.
2. **Kompresi GZIP:** File `level.dat` dan `level.dat_old` **wajib** dikompres menggunakan GZIP, bukan raw uncompressed NBT atau Zip biasa.
3. **Penyertaan Metadata Versi:** Harus menyertakan `DataVersion: 2567` dan Compound `Version` (`Id: 2567`, `Name: "1.16.1"`) agar game tidak menampilkan peringatan error *"Unknown Version"*.
4. **Generator Name:** Wajib menyertakan `generatorName: "default"` dan `generatorVersion: 1` agar Minecraft 1.16.1 mengenali tipe generasi Overworld standar.
5. **Client-Side Only:** Kode tidak boleh bergantung pada Node.js native module (seperti `fs` atau `child_process`) agar tetap dapat di-host secara gratis di platform statis seperti Netlify.

# Version
* **Target Game:** Minecraft Java Edition `1.16.1` (DataVersion `2567`, NBT version `19133`)
* **Project Status:** v1.2.0 (Multi-Octave Perlin Noise Rolling Plains & Anvil Region Generator)