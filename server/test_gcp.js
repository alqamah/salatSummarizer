const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

const storage = new Storage({ apiKey: process.env.GCP_API_KEY });
async function test() {
    try {
        const bucketName = 'salat-sum-bucket';
        const filePath = '../todo.txt';
        const destFileName = 'output/audio-files/test.txt';

        console.log("Attempting upload...");
        await storage.bucket(bucketName).upload(filePath, {
            destination: destFileName,
        });
        console.log("Upload successful!");
    } catch (error) {
        console.error("Upload failed:");
        console.error(error);
    }
}

test();
