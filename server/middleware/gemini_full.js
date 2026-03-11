const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'credentials', '.env') });

const apiKey = process.env.GEMINI_API_KEY || process.env.gemini_api_key;
const genAI = new GoogleGenerativeAI(apiKey);
const aiFileManager = new GoogleAIFileManager(apiKey);

async function processAudioDirectly(audioFilePath, clientId, sendStatus) {
    let summary = "Summary unavailable.";
    let transcription = "Transcription unavailable (direct Gemini processing).";
    let aiError = null;

    if (clientId && sendStatus) sendStatus(clientId, `Uploading audio to Gemini...`);
    console.log(`Uploading audio to Gemini: ${audioFilePath}`);

    try {
        const uploadResult = await aiFileManager.uploadFile(audioFilePath, {
            mimeType: "audio/mp3",
            displayName: "Trimmed Audio",
        });

        if (clientId && sendStatus) sendStatus(clientId, `Processing audio with Gemini AI...`);
        console.log(`Processing with Gemini AI (File URI: ${uploadResult.file.uri})...`);

        const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are a Quranic transcription and summarization assistant.
Here is an audio recording of an Arabic recitation.
Please:
1. Provide the transcription of the recited verses in Arabic.
2. Identify the likely Surah and Ayahs (verses) recited.
3. Provide a thematic summary of the recited verses in English.
Output your response clearly separating the Transcription and Summary.
Max Token Count: 1000`;

        const aiResponse = await aiModel.generateContent([
            {
                fileData: {
                    mimeType: uploadResult.file.mimeType,
                    fileUri: uploadResult.file.uri
                }
            },
            prompt
        ]);

        const resultText = aiResponse.response.text();
        summary = resultText;
        transcription = "Generated securely via Gemini Audio natively:\\n\\n" + resultText;

        if (clientId && sendStatus) sendStatus(clientId, `Gemini processing complete.`);
        console.log(`Gemini audio processing generated successfully.`);

        // Clean up file from Gemini after processing
        try {
            await aiFileManager.deleteFile(uploadResult.file.name);
        } catch (err) {
            console.error("Failed to delete file from Gemini:", err);
        }

    } catch (aiErr) {
        console.error('SERVER ERROR DETAILS (Gemini Full):', aiErr);
        if (clientId && sendStatus) sendStatus(clientId, `Gemini direct processing failed. See console.`);
        aiError = aiErr.message || JSON.stringify(aiErr);
    }

    return { transcription, summary, aiError };
}

module.exports = { processAudioDirectly };
