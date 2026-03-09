const speech = require('@google-cloud/speech');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config(); // Load server .env too

async function testV1() {
    console.log('--- Testing STT V1 ---');
    const client = new speech.SpeechClient({
        keyFilename: path.join(__dirname, '..', 'salat-summariser-key.json')
    });
    try {
        // Just a dummy list recognizers or something simple? 
        // V1 doesn't have a simple "check permission" call other than trying a dummy request.
        console.log('STT V1 Client initialized.');
    } catch (err) {
        console.error('STT V1 Initialization failed:', err.message);
    }
}

async function testV2() {
    console.log('\n--- Testing STT V2 ---');
    const client = new speech.v2.SpeechClient({
        keyFilename: path.join(__dirname, '..', 'salat-summariser-key.json')
    });

    const projectId = 'salat-summariser';
    try {
        console.log('Attempting to list recognizers in us-central1 (V2)...');
        const [recognizers] = await client.listRecognizers({
            parent: `projects/${projectId}/locations/us-central1`,
        });
        console.log(`Found ${recognizers.length} recognizers.`);
    } catch (err) {
        console.error('STT V2 ListRecognizers failed:', err.message);
        if (err.message.includes('PERMISSION_DENIED')) {
            console.error('CRITICAL: Service account lacks STT V2 permissions or API is not enabled.');
        }
    }
}

async function run() {
    await testV1();
    await testV2();
}

run();
