const speech = require('@google-cloud/speech');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'credentials', '.env') });

const speechClient = new speech.SpeechClient();

async function performSTT(gcsUri, clientId, sendStatus) {
    if (clientId && sendStatus) sendStatus(clientId, `Starting STT job (V1 latest_long)...`);
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
        if (clientId && sendStatus) sendStatus(clientId, `Waiting for STT operation to complete...`);

        const [response] = await operation.promise();

        if (!response.results || response.results.length === 0) {
            throw new Error("No transcription results found.");
        }

        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        if (clientId && sendStatus) sendStatus(clientId, `Transcription finished!`);
        console.log(`Transcription: ${transcription}`);
        return transcription;
    } catch (err) {
        console.error('STT V1 Error:', err);
        throw err;
    }
}

module.exports = { performSTT };
