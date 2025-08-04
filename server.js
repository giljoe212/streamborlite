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

    const { streamUrl, streamKey, videoUrl } = req.body;
    
    if (!streamUrl || !streamKey || !videoUrl) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const rtmpUrl = `${streamUrl}/${streamKey}`;
        
        // Start FFmpeg process with stream copy (no re-encoding)
        const command = ffmpeg()
            .input(videoUrl)
            .inputOptions([
                '-re',              // Read input at native frame rate
                '-stream_loop -1',  // Loop the input
                '-copyts',          // Copy timestamps
                '-start_at_zero'    // Start at zero timestamp
            ])
            .outputOptions([
                '-c:v copy',        // Copy video codec (no re-encoding)
                '-c:a aac',         // Convert audio to AAC (required for RTMP)
                '-ar 44100',        // Audio sample rate
                '-ac 2',            // Audio channels (stereo)
                '-b:a 128k',        // Audio bitrate
                '-f flv',           // Output format
                '-flvflags no_duration_filesize'  // Fix for some RTMP servers
            ])
            .output(rtmpUrl)
            .on('stderr', function(stderrLine) {
                console.log('FFmpeg output: ' + stderrLine);
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
