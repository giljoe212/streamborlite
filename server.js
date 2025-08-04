require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const https = require('https');
const multer = require('multer');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Accept video files only
        if (!file.mimetype.startsWith('video/')) {
            return cb(new Error('Hanya file video yang diperbolehkan'));
        }
        cb(null, true);
    },
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(fileUpload());

// In-memory store for stream status
let streamStatus = {
    isStreaming: false,
    process: null,
    streamUrl: '',
    streamKey: '',
    videoPath: ''
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to get YouTube stream URL
async function getYouTubeStreamUrl(url) {
    try {
        const info = await ytdl.getInfo(url);
        // Get the highest quality format with both video and audio
        const format = ytdl.chooseFormat(info.formats, { 
            quality: 'highest',
            filter: format => format.hasVideo && format.hasAudio
        });
        
        if (!format) {
            throw new Error('Tidak dapat menemukan format video yang sesuai');
        }
        
        return format.url;
    } catch (error) {
        console.error('Error getting YouTube stream URL:', error);
        throw new Error('Gagal mendapatkan URL streaming dari YouTube');
    }
}

// Start streaming
app.post('/api/stream/start', async (req, res) => {
    if (streamStatus.isStreaming) {
        return res.status(400).json({ error: 'Stream is already running' });
    }

    const { streamKey, videoUrl } = req.body;

    if (!streamKey || !videoUrl) {
        return res.status(400).json({ error: 'Stream Key dan URL video harus diisi' });
    }

    try {
        let processedUrl = videoUrl;
        
        // Check if it's a YouTube URL
        if (ytdl.validateURL(videoUrl)) {
            console.log('Mendeteksi URL YouTube, mengambil URL streaming...');
            processedUrl = await getYouTubeStreamUrl(videoUrl);
            console.log('Berhasil mendapatkan URL streaming YouTube');
        }
        // Check if it's a Google Drive URL
        else if (videoUrl.includes('drive.google.com')) {
            const fileIdMatch = videoUrl.match(/[\w-]{20,}/);
            if (fileIdMatch && fileIdMatch[0]) {
                const fileId = fileIdMatch[0];
                
                try {
                    // Create temp directory if not exists
                    const tempDir = path.join(__dirname, 'temp');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }
                    
                    // Generate unique filename
                    const filename = `temp_${Date.now()}.mp4`;
                    const filePath = path.join(tempDir, filename);
                    
                    // Download file first
                    await new Promise((resolve, reject) => {
                        const fileUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                        const fileStream = fs.createWriteStream(filePath);
                        
                        console.log(`Downloading file from Google Drive: ${fileId}`);
                        
                        const downloadWithRetry = (url, retries = 3) => {
                            const request = https.get(url, (response) => {
                                // Handle redirects
                                if (response.statusCode === 302 || response.statusCode === 301) {
                                    console.log('Redirecting to:', response.headers.location);
                                    downloadWithRetry(response.headers.location, retries);
                                    return;
                                }
                                
                                // Check if the response is a file
                                const contentType = response.headers['content-type'] || '';
                                if (!contentType.startsWith('video/') && !contentType.includes('octet-stream')) {
                                    reject(new Error('URL tidak mengarah ke file video yang valid'));
                                    return;
                                }
                                
                                // Pipe the response to file
                                response.pipe(fileStream);
                                
                                fileStream.on('finish', () => {
                                    fileStream.close();
                                    console.log('Download completed:', filePath);
                                    resolve();
                                });
                            });
                            
                            request.on('error', (err) => {
                                console.error('Download error:', err);
                                if (retries > 0) {
                                    console.log(`Retrying... (${retries} attempts left)`);
                                    setTimeout(() => downloadWithRetry(url, retries - 1), 1000);
                                } else {
                                    fs.unlink(filePath, () => {}); // Delete the file async
                                    reject(new Error('Gagal mengunduh file dari Google Drive setelah beberapa kali percobaan'));
                                }
                            });
                            
                            // Set timeout
                            request.setTimeout(30000, () => {
                                request.destroy();
                                console.error('Download timeout');
                                if (retries > 0) {
                                    console.log(`Retrying... (${retries} attempts left)`);
                                    setTimeout(() => downloadWithRetry(url, retries - 1), 1000);
                                } else {
                                    fs.unlink(filePath, () => {});
                                    reject(new Error('Timeout saat mengunduh file'));
                                }
                            });
                        };
                        
                        // Start the download
                        downloadWithRetry(fileUrl);
                    });
                    
                    // Use the downloaded file with a local URL
                    processedUrl = `http://localhost:${PORT}/temp/${path.basename(filePath)}`;
                } catch (error) {
                    console.error('Error downloading file:', error);
                    return res.status(500).json({ error: 'Gagal mengunduh file dari Google Drive' });
                }
            } else {
                console.error('Invalid Google Drive URL format');
                return res.status(400).json({ error: 'Format URL Google Drive tidak valid. Pastikan URL berisi ID file yang benar.' });
            }
        }

        // Configure FFmpeg for MP4 streaming
        const command = ffmpeg()
            .input(processedUrl)
            .on('error', (err, stdout, stderr) => {
                console.error('FFmpeg error:', err.message);
                console.error('FFmpeg stderr:', stderr);
                streamStatus.isStreaming = false;
            })
            .inputOptions([
                '-re',                  // Read input at native frame rate
                '-stream_loop -1',      // Loop the input
                '-copyts',              // Copy timestamps
                '-start_at_zero',       // Start at zero timestamp
                '-fflags +genpts',      // Generate PTS if missing
                '-analyzeduration 10M', // Increase analyze duration
                '-probesize 10M'        // Increase probe size
            ])
            .outputOptions([
                // Video settings
                '-c:v copy',            // Copy video stream
                '-bsf:v h264_mp4toannexb', // Required for some MP4 files
                // Audio settings
                '-c:a aac',             // Convert audio to AAC (required for RTMP)
                '-ar 44100',            // Audio sample rate
                '-ac 2',                // Stereo audio
                '-b:a 128k',            // Audio bitrate
                // Output format
                '-f flv',               // FLV container for RTMP
                // Streaming optimizations
                '-flvflags no_duration_filesize',
                '-rtmp_buffer 100',     // Buffer size
                '-rtmp_live live',      // Live streaming mode
                '-timeout 3000000',     // 50 minutes timeout
                // Reconnection settings
                '-reconnect 1',
                '-reconnect_at_eof 1',
                '-reconnect_streamed 1',
                '-reconnect_delay_max 2',
                // Other optimizations
                '-avoid_negative_ts make_zero',
                '-fflags +genpts',
                '-movflags +faststart'
            ])
            .output(rtmpUrl)
            .on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
                console.log('Streaming to:', rtmpUrl);
            })
            .on('stderr', (stderrLine) => {
                console.log('FFmpeg output:', stderrLine);
            })
            .on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
                streamStatus = {
                    isStreaming: true,
                    streamUrl: streamUrl,
                    streamKey: streamKey,
                    videoPath: videoUrl,
                    startTime: new Date()
                };
            })
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
                streamStatus.isStreaming = false;
            })
            .on('end', () => {
                console.log('Stream ended');
                streamStatus.isStreaming = false;
            });

        // Start the process
        streamStatus.process = command.run();
        
        res.json({ message: 'Stream started successfully' });
    } catch (error) {
        console.error('Error starting stream:', error);
        res.status(500).json({ error: 'Failed to start stream' });
    }
});

// Stop streaming
app.post('/api/stream/stop', (req, res) => {
    if (!streamStatus.isStreaming) {
        return res.status(400).json({ error: 'No active stream' });
    }

    try {
        if (streamStatus.process) {
            streamStatus.process.kill('SIGKILL');
        }
        streamStatus = {
            isStreaming: false,
            process: null,
            streamUrl: '',
            streamKey: '',
            videoPath: ''
        };
        
        res.json({ message: 'Stream stopped successfully' });
    } catch (error) {
        console.error('Error stopping stream:', error);
        res.status(500).json({ error: 'Failed to stop stream' });
    }
});

// Get stream status
app.get('/api/stream/status', (req, res) => {
    res.json({
        isStreaming: streamStatus.isStreaming,
        streamUrl: streamStatus.streamUrl,
        startTime: streamStatus.startTime,
        videoPath: streamStatus.videoPath
    });
});

// Handle file uploads
app.post('/api/upload', upload.single('video'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file yang diupload' });
        }

        // In a production environment, you would upload this to a CDN or cloud storage
        // For now, we'll just return the local file path
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.originalname
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Gagal mengupload file' });
    }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Serve downloaded temp files
app.use('/temp', express.static('temp'));

// Clean up temp files on server start
const cleanTempFiles = () => {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach(file => {
            try {
                fs.unlinkSync(path.join(tempDir, file));
                console.log(`Cleaned up temp file: ${file}`);
            } catch (err) {
                console.error(`Error deleting temp file ${file}:`, err);
            }
        });
    }
};

// Run cleanup on start
cleanTempFiles();

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
