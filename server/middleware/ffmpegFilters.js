const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

async function trimAudio(inAudio, noiseFlag, trimFlag, ...geminiArgs) {
    let outAudio = inAudio;

    if (trimFlag) {
        const outStart = 60; // 60s
        
        // Get inAudio length
        const duration = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inAudio, (err, metadata) => {
                if (err) return reject(err);
                resolve(metadata.format.duration);
            });
        });
        
        const outDuration = duration * 0.50; // 50% of inAudio length
        
        // Create a new filename for the trimmed audio
        const ext = path.extname(inAudio);
        outAudio = inAudio.replace(ext, `_trimmed${ext}`);

        // ffmpeg-trim-audio(outStart, outDuration)
        await new Promise((resolve, reject) => {
            ffmpeg(inAudio)
                .setStartTime(outStart)
                .setDuration(outDuration)
                .on('end', resolve)
                .on('error', reject)
                .save(outAudio);
        });
    }

    return await noiseFilter(outAudio, noiseFlag);
}

async function noiseFilter(outAudio, noiseFlag) {
    if (noiseFlag) {
        const ext = path.extname(outAudio);
        const filteredAudio = outAudio.replace(ext, `_filtered${ext}`);

        // ffmpeg-noise-filter(outAudio)
        await new Promise((resolve, reject) => {
            ffmpeg(outAudio)
                .audioFilters([
                    'afftdn', // fast fourier transform based noise reduction
                    'silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-50dB' // optional silence removal
                ])
                .on('end', resolve)
                .on('error', reject)
                .save(filteredAudio);
        });
        
        outAudio = filteredAudio;
    }

    return outAudio;
}

module.exports = {
    trimAudio,
    noiseFilter
};
