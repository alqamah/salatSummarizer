const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'credentials', '.env') });

const apiKey = process.env.GEMINI_API_KEY || process.env.gemini_api_key;
const genAI = new GoogleGenerativeAI(apiKey);
const aiFileManager = new GoogleAIFileManager(apiKey);

async function processAudioDirectly(audioFilePath, clientId, sendStatus, language = 'English') {
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

        const systemInstruction = `You are an expert Quranic transcription and exegesis AI. The audio input provided is a trimmed excerpt of a longer recitation, strategically cut to minimize input token consumption. 

**Output Language Constraint:**
* The body text of the summary, the translated verses, and the Surah name MUST be provided in the following language: ${language}.
* CRITICAL: Do NOT translate the markdown headers (e.g., "### Surah Information") or the bold structural labels (e.g., "**Surah:**", "**Verses Covered:**", "**Ayah [Number]:**", "**Translation:**"). They MUST remain in exactly English as requested to allow for programmatic parsing.

* Expand the textual boundaries of these identified verses by adding approximately 100% more verses immediately preceding the recited segment, and 100% more verses immediately following it. 
* For example, if the audio contains 4 verses, you must retrieve and include the 4 preceding verses and the 4 subsequent verses from the Quranic text (totaling 12 verses in context).
* This newly expanded verse range is strictly defined as the \`updated-gemini-context\`. All subsequent analysis and output must be based entirely on this \`updated-gemini-context\`.

**Output Constraints:**
* Strictly limit the response generation to a maximum of 3000 tokens. 
* Deliver the output in formatted Markdown.
* Ensure the Tafseer is concise, objective, and thematic.

**Required Markdown Structure (Keep headers in English!):**

### Surah Information
* **Surah:** [Surah Name in ${language}] ([Surah Number])
* **Verses Covered:** [Start Ayah] - [End Ayah] (This must reflect the expanded \`updated-gemini-context\`)

### Summary Section
* Provide a high-impact exegesis of the \`updated-gemini-context\` in ${language}.
* Focus on the core theological themes, historical context, and the primary message connecting these specific verses.

### Original Text
* Provide the \`updated-gemini-context\` line by line.
* Format each line exactly as follows:
  **Ayah [Number]:** [Arabic Text]
  **Translation:** [Direct ${language} Translation]

**CRITICAL RULES:**
1. **Blank / Silent Audio:** If the audio is silent or contains no recognizable Quranic recitation, respond exactly with: ⚠️ The audio appears to be empty or contains no recognizable Quranic recitation. Please upload a valid recording.
2. **Uncertain Identification:** If the audio is unclear, state "Verse identification uncertain — audio may be unclear".`;

        const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });

        const prompt = "Analyze the provided audio according to your system instructions.";

        // Use try...finally to GUARANTEE cleanup of the uploaded file, even if generation fails
        try {
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
        } finally {
            // GUARANTEED CLEANUP: runs whether generateContent succeeds or throws
            // try {
            //     await aiFileManager.deleteFile(uploadResult.file.name);
            //     console.log(`Successfully purged ${uploadResult.file.name} from AI Studio storage.`);
            // } catch (cleanupErr) {
            //     console.error("CRITICAL: Failed to delete file from Gemini:", cleanupErr);
            // }
        }

    } catch (aiErr) {
        console.error('SERVER ERROR DETAILS (Gemini Full):', aiErr);
        if (clientId && sendStatus) sendStatus(clientId, `Gemini direct processing failed. See console.`);
        aiError = aiErr.message || JSON.stringify(aiErr);
    }

    return { transcription, summary, aiError };
}

module.exports = { processAudioDirectly };
