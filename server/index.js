const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Serve the uploads directory statically to access processed files
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

app.post('/api/process-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded.' });
  }

  const inputPath = req.file.path;
  const originalExt = path.extname(req.file.originalname) || '.mp3';
  const finalFilename = `processed-${path.basename(req.file.filename, path.extname(req.file.filename))}${originalExt}`;
  const outputPath = path.join(UPLOAD_DIR, finalFilename);

  try {
    console.log(`Processing file: ${inputPath}`);
    // Apply FFmpeg filters: noise reduction and silence removal
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          'afftdn', // fast fourier transform based noise reduction
          'silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-50dB'
        ])
        .on('end', () => {
          console.log('FFmpeg processing completed successfully.');
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .save(outputPath);
    });

    console.log(`Transcribing processed file: ${outputPath}`);
    // OpenAI Whisper API expects a File stream
    let transcriptionText = '';

    // Check if OPENAI_API_KEY is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY is missing. Skipping transcription.");
      transcriptionText = "[STT generation skipped because OPENAI_API_KEY is not configured]";
    } else {
      try {
        const audioStream = fs.createReadStream(outputPath);
        const response = await openai.audio.transcriptions.create({
          file: audioStream,
          model: 'whisper-1'
        });
        transcriptionText = response.text;
      } catch (sttError) {
        console.error('OpenAI Error:', sttError.message);
        transcriptionText = `[STT failed: ${sttError.message}]`;
      }
    }

    const processedAudioUrl = `http://localhost:${port}/uploads/${finalFilename}`;

    // Clean up the original uploaded file (optional, but good for space)
    fs.unlink(inputPath, (err) => {
      if (err) console.error('Failed to cleanup original file:', err);
    });

    res.json({
      success: true,
      transcription: transcriptionText,
      processedAudioUrl: processedAudioUrl
    });

  } catch (error) {
    console.error('Error during audio processing:', error);
    // Cleanup files if possible
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    res.status(500).json({ error: 'Internal server error during audio processing.', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
