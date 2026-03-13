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
        const prompt = `You are an expert Quranic transcription and exegesis AI. The transcript provided below is derived from a trimmed excerpt of a longer recitation via Speech-to-Text, and may contain minor phonetic errors — correct these as part of your analysis.

**Core Processing Logic (\`updated-gemini-context\`):**
* Identify the exact Surah and Ayahs (verses) recited from the transcript below.
* Expand the textual boundaries of these identified verses by adding approximately 50% more verses immediately preceding the recited segment, and 50% more verses immediately following it.
* For example, if the transcript contains 4 verses, you must retrieve and include the 2 preceding verses and the 2 subsequent verses from the Quranic text.
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
  **Translation:** [Direct English Translation]

---
**Transcript:**
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
