const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const speech = require('@google-cloud/speech');
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

const gcsClient = new Storage();
const speechClient = new speech.SpeechClient();

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

    // Get audio duration
    const duration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration);
      });
    });

    const startTime = duration * 0.25;
    const durationToKeep = duration * 0.50;

    // Apply FFmpeg filters: trimming, noise reduction, and silence removal
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(durationToKeep)
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

    const bucketName = process.env.GCS_BUCKET_NAME || 'salat-sum-bucket';
    const gcsDestination = `output/audio-files/${finalFilename}`;

    console.log(`Uploading processed audio to GCS bucket: ${bucketName}...`);
    await gcsClient.bucket(bucketName).upload(outputPath, {
      destination: gcsDestination,
      metadata: {
        contentType: 'audio/mpeg', // assuming mp3
      }
    });

    const gcsUri = `gs://${bucketName}/${gcsDestination}`;
    console.log(`Uploaded to GCS: ${gcsUri}`);

    console.log(`Starting STT job...`);
    // Transcribes your audio file using the specified configuration.
    const config = {
      model: "latest_long",
      encoding: "MP3",
      sampleRateHertz: 48000,
      audioChannelCount: 2,
      enableWordTimeOffsets: true,
      enableWordConfidence: true,
      languageCode: "ar-SA",
    };

    const request = {
      audio: { uri: gcsUri },
      config: config,
    };

    const [operation] = await speechClient.longRunningRecognize(request);
    console.log(`Waiting for STT operation to complete...`);
    const [response] = await operation.promise();

    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    console.log(`Transcription: ${transcription}`);

    const processedAudioUrl = `http://localhost:${port}/uploads/${finalFilename}`;

    // Clean up the original uploaded file
    fs.unlink(inputPath, (err) => {
      if (err) console.error('Failed to cleanup original file:', err);
    });

    res.json({
      success: true,
      processedAudioUrl: processedAudioUrl,
      transcript: transcription
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
