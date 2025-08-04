# YouTube Live Streamer

Aplikasi web sederhana untuk melakukan live streaming ke YouTube menggunakan FFmpeg tanpa encoding (stream copy) dari video yang ada di Google Drive.

## Fitur

- Stream video langsung dari Google Drive ke YouTube
- Tanpa encoding (menggunakan stream copy)
- Antarmuka web yang mudah digunakan
- Status streaming real-time
- Log aktivitas

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

3. Masukkan detail streaming:
   - RTMP URL: Dapatkan dari YouTube Studio (biasanya `rtmp://a.rtmp.youtube.com/live2`)
   - Stream Key: Dapatkan dari YouTube Studio
   - Google Drive Video URL: URL shareable dari video di Google Drive

4. Klik "Start Stream" untuk memulai streaming

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
