# YouTube Live Streamer

Aplikasi web sederhana untuk melakukan live streaming ke YouTube menggunakan FFmpeg tanpa encoding (stream copy) dari video yang ada di Google Drive.

## Fitur

- Stream video langsung dari berbagai sumber (Google Drive, URL langsung)
- Dukungan format MP4 dengan codec H.264/AAC
- Tanpa encoding (menggunakan stream copy)
- Antarmuka web yang mudah digunakan
- Status streaming real-time
- Log aktivitas
- Optimasi untuk streaming jangka panjang

## Persyaratan

- Node.js (v14 atau lebih baru)
- FFmpeg (harus terinstall di sistem)
- Akun YouTube dengan akses live streaming

## Instalasi

1. Clone repositori ini:
   ```bash
   git clone [URL_REPOSITORY_ANDA]
   cd youtube-streamer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Buat file `.env` di root direktori:
   ```env
   PORT=3000
   ```

## Penggunaan

1. Jalankan server:
   ```bash
   npm start
   ```
   Atau untuk mode pengembangan:
   ```bash
   npm run dev
   ```

2. Buka browser dan akses `http://localhost:3000`

3. Dapatkan Stream Key dari YouTube Studio:
   - Buka [YouTube Studio](https://studio.youtube.com/)
   - Pilih "Go Live" di menu kiri
   - Pilih tab "Stream"
   - Salin "Stream Key" (kode panjang di bagian bawah)

4. Masukkan detail streaming:
   - **Stream Key**: Tempel kode yang sudah disalin
   - **Video URL**:
     - Untuk Google Drive:
       1. Upload video ke Google Drive
       2. Klik kanan file > Dapatkan link
       3. Pastikan akses "Anyone with the link"
       4. Salin URL-nya
     - Atau gunakan URL langsung ke file MP4

5. Klik "Start Stream" untuk memulai streaming

### Format Video yang Direkomendasikan
- Video: H.264 (AVC)
- Audio: AAC
- Resolusi: 1920x1080 (1080p) atau 1280x720 (720p)
- Bitrate: Sesuai standar YouTube Live
- Container: MP4

### Catatan Penting
- Pastikan video sudah dalam format yang kompatibel
- Untuk hasil terbaik, gunakan video dengan bitrate konstan (CBR)
- Pastikan koneksi internet stabil untuk streaming lancar

## Deploy ke Railway

1. Buat akun di [Railway](https://railway.app/) jika belum punya
2. Install Railway CLI:
   ```bash
   npm i -g @railway/cli
   ```
3. Login ke Railway:
   ```bash
   railway login
   ```
4. Inisialisasi proyek:
   ```bash
   railway init
   ```
5. Deploy ke Railway:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push railway main
   ```

## Catatan

- Pastikan video di Google Drive sudah dalam format yang kompatibel dengan YouTube Live Streaming
- Gunakan koneksi internet yang stabil untuk streaming
- Untuk kualitas terbaik, gunakan video dengan bitrate yang sesuai dengan rekomendasi YouTube

## Lisensi

MIT
