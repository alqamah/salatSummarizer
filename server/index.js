const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const speech = require('@google-cloud/speech');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, 'credentials', '.env') });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const clients = {};

app.get('/api/status', (req, res) => {
  const clientId = req.query.clientId;
  if (!clientId) return res.status(400).json({ error: 'clientId required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  clients[clientId] = res;

  req.on('close', () => {
    delete clients[clientId];
  });
});

const sendStatus = (clientId, message) => {
  console.log(message);
  if (clients[clientId]) {
    clients[clientId].write(`data: ${JSON.stringify({ status: message })}\n\n`);
  }
};

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
const genAI = new GoogleGenerativeAI(process.env.gemini_api_key);

async function performSTT(gcsUri, clientId) {
  if (clientId) sendStatus(clientId, `Starting STT job (V1 latest_long)...`);
  console.log(`Starting STT job (V1 latest_long)...`);

  const config = {
    encoding: 'MP3',
    sampleRateHertz: 48000,
    languageCode: 'ar-SA',
    model: 'latest_long',
    enableWordTimeOffsets: true,
    enableWordConfidence: true,
    enableAutomaticPunctuation: true
  };

  const request = {
    audio: { uri: gcsUri },
    config: config,
  };

  try {
    const [operation] = await speechClient.longRunningRecognize(request);
    if (clientId) sendStatus(clientId, `Waiting for STT operation to complete...`);

    const [response] = await operation.promise();

    if (!response.results || response.results.length === 0) {
      throw new Error("No transcription results found.");
    }

    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    if (clientId) sendStatus(clientId, `Transcription finished!`);
    console.log(`Transcription: ${transcription}`);
    return transcription;
  } catch (err) {
    console.error('STT V1 Error:', err);
    throw err;
  }
}

async function generateSummary(transcription, clientId) {
  let summary = "Summary unavailable.";
  let aiError = null;

  if (clientId) sendStatus(clientId, `Summarizing with AI...`);
  console.log(`Summarizing transcription with AI...`);

  try {
    // Using gemini-2.5-flash as the fallback model for 'gemma 3' via AI Studio
    const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are a Quranic transcription and summarization assistant.
Here is a raw Arabic transcript from an audio recitation. It may contain phonetic STT errors.
Please:
1. Identify the likely Surah and Ayahs (verses) recited.
2. Provide a thematic summary of the recited verses in English.
3. Correct obvious phonetic transcription errors (e.g. confusing الغيظ with الغيب).

Transcript:
${transcription}`;

    const aiResponse = await aiModel.generateContent(prompt);
    summary = aiResponse.response.text();

    if (clientId) sendStatus(clientId, `Summarization complete.`);
    console.log(`Summary generated successfully.`);
  } catch (aiErr) {
    console.error('SERVER ERROR DETAILS (Gemini):', aiErr);
    if (clientId) sendStatus(clientId, `Warning: Summarization failed. See console.`);
    aiError = aiErr.message || JSON.stringify(aiErr);
  }

  return { summary, aiError };
}

app.post('/api/process-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded.' });
  }

  const clientId = req.body.clientId;
  const inputPath = req.file.path;
  const originalExt = path.extname(req.file.originalname) || '.mp3';
  const finalFilename = `processed-${path.basename(req.file.filename, path.extname(req.file.filename))}${originalExt}`;
  const outputPath = path.join(UPLOAD_DIR, finalFilename);

  try {
    if (clientId) sendStatus(clientId, `Processing file: ${req.file.originalname}`);
    console.log(`Processing file: ${inputPath}`);

    // Get audio duration
    const duration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration);
      });
    });

    const startTime = duration * 0.30;
    const durationToKeep = duration * 0.40;

    // Apply FFmpeg filters: trimming, noise reduction, and silence removal
    if (clientId) sendStatus(clientId, `Applying FFmpeg filters and trimming audio...`);
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(durationToKeep)
        .audioFilters([
          'afftdn', // fast fourier transform based noise reduction
          'silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-50dB'
        ])
        .on('end', () => {
          if (clientId) sendStatus(clientId, 'FFmpeg processing completed successfully.');
          console.log('FFmpeg processing completed successfully.');
          resolve();
        })
        .on('error', (err) => {
          if (clientId) sendStatus(clientId, `FFmpeg error: ${err.message}`);
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .save(outputPath);
    });

    const bucketName = process.env.GCS_BUCKET_NAME || 'salat-sum-bucket';
    const gcsDestination = `output/audio-files/${finalFilename}`;

    if (clientId) sendStatus(clientId, `Uploading processed audio to GCS bucket: ${bucketName}...`);
    console.log(`Uploading processed audio to GCS bucket: ${bucketName}...`);
    await gcsClient.bucket(bucketName).upload(outputPath, {
      destination: gcsDestination,
      metadata: {
        contentType: 'audio/mpeg', // assuming mp3
      }
    });

    const gcsUri = `gs://${bucketName}/${gcsDestination}`;
    if (clientId) sendStatus(clientId, `Uploaded to GCS successfully.`);
    console.log(`Uploaded to GCS: ${gcsUri}`);

    // Call the decoupled services
    const transcription = await performSTT(gcsUri, clientId);
    const { summary, aiError } = await generateSummary(transcription, clientId);

    const processedAudioUrl = `http://localhost:${port}/uploads/${finalFilename}`;

    // Clean up the original uploaded file
    fs.unlink(inputPath, (err) => {
      if (err) console.error('Failed to cleanup original file:', err);
    });

    res.json({
      success: true,
      processedAudioUrl: processedAudioUrl,
      transcript: transcription,
      summary: summary,
      aiError: aiError
    });

  } catch (error) {
    if (clientId) sendStatus(clientId, `Error: ${error.message}`);
    console.error('Error during audio processing:', error);
    // Cleanup files if possible
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    console.error('SERVER ERROR DETAILS:', error);
    res.status(500).json({
      error: 'Internal server error during audio processing.',
      details: error.message,
      fullError: error.stack || JSON.stringify(error, null, 2)
    });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
