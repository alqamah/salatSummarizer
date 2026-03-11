const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'credentials', '.env') });

const apiKey = process.env.GEMINI_API_KEY || process.env.gemini_api_key;
const genAI = new GoogleGenerativeAI(apiKey);

async function generateSummary(transcription, clientId, sendStatus) {
    let summary = "Summary unavailable.";
    let aiError = null;

    if (clientId && sendStatus) sendStatus(clientId, `Summarizing with AI...`);
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

        if (clientId && sendStatus) sendStatus(clientId, `Summarization complete.`);
        console.log(`Summary generated successfully.`);
    } catch (aiErr) {
        console.error('SERVER ERROR DETAILS (Gemini):', aiErr);
        if (clientId && sendStatus) sendStatus(clientId, `Warning: Summarization failed. See console.`);
        aiError = aiErr.message || JSON.stringify(aiErr);
    }

    return { summary, aiError };
}

module.exports = { generateSummary };
