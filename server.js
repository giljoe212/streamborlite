

require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Start streaming
app.post('/api/stream/start', async (req, res) => {
    if (streamStatus.isStreaming) {
        return res.status(400).json({ error: 'Stream is already running' });
    }

    const { streamKey, videoUrl } = req.body;
    const streamUrl = 'rtmp://a.rtmp.youtube.com/live2';
    
    if (!streamKey || !videoUrl) {
        return res.status(400).json({ error: 'Stream Key dan URL video harus diisi' });
    }

    try {
        const rtmpUrl = `${streamUrl}/${streamKey}`;
        
                // Process Google Drive URL
        let processedUrl = videoUrl;
        
        // Convert Google Drive sharing URL to direct download URL
        if (videoUrl.includes('drive.google.com')) {
            const fileIdMatch = videoUrl.match(/[\w-]{20,}/);
            if (fileIdMatch && fileIdMatch[0]) {
                processedUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[0]}`;
                console.log('Converted Google Drive URL:', processedUrl);
            } else {
                console.error('Invalid Google Drive URL format');
                return res.status(400).json({ error: 'Invalid Google Drive URL format' });
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
