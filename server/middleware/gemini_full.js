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
        const prompt = `You are an expert Quranic transcription and exegesis AI. The audio input provided is a trimmed excerpt of a longer recitation, strategically cut to minimize input token consumption.

**Core Processing Logic (\`updated-gemini-context\`):**
* Identify the exact Surah and Ayahs (verses) recited in the raw audio.
* Expand the textual boundaries of these identified verses by adding approximately 100% more verses immediately preceding the recited segment, and 100% more verses immediately following it.
* For example, if the audio contains 4 verses, you must retrieve and include the 4 preceding verses and the 4 subsequent verses from the Quranic text.
* This newly expanded verse range is strictly defined as the \`updated-gemini-context\`. All subsequent analysis and output must be based entirely on this \`updated-gemini-context\`.

**Output Constraints:**
* Strictly limit the response generation to a maximum of 1000 tokens.
* Deliver the output in formatted Markdown.
* Ensure the Tafseer is concise, objective, and thematic.

**Required Markdown Structure:**

### Surah Information
* **Surah:** [Surah Name] ([Surah Number])
* **Verses Covered:** [Start Ayah] - [End Ayah] (This must reflect the expanded \`updated-gemini-context\`)

### Summary Section (Tafseer)
* Provide a high-impact exegesis of the \`updated-gemini-context\`.
* Focus on the core theological themes, historical context, and the primary message connecting these specific verses.

### Original Text and Translation
* Provide the \`updated-gemini-context\` line by line.
* Format each line exactly as follows:
  **Ayah [Number]:** [Arabic Text]
  **Translation:** [Direct English Translation]`;

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
        transcription = null; // No separate transcription for direct Gemini path; summary contains the full structured response.

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
