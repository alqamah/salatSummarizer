```markdown
# Project Roadmap: Quranic STT & Analysis

## Feature Backlog
* Integrate FFmpeg for audio preprocessing and quality tuning.
* Research free STT alternatives like faster-whisper or Google Chirp 2.

## Current Sprint: Fuzzy Search & Identification
* Develop fuzzy search logic to align phonetic transcripts with Quranic text.
* Build a module to map text segments to Surah/Ayah coordinates.
* Create a service for thematic summarization of identified verses.
* Use audio length to estimate verse ranges and narrow search windows.

## Infrastructure & STT Optimization
* Implement speech adaptation phrase sets for Quranic terminology.
* Configure STT V2 Recognizer with Chirp 2 and automatic punctuation.
* Set up GCS lifecycle policies to maintain free-tier storage limits.

## Backend & Security
* Harden service account security and clean up legacy credentials.
* Optimize STT for Tajweed-specific phonetic nuances.

## Data Verification
* Programmatically correct recurring transcription errors.
* Use word-level confidence scores to flag segments for review.
```

## 09/03/2026

* **use gemini for STT and summary directly** ✅
* **improve ui** ✅
* **trim the audio in a better way** improve audio trimming logic
* **add alternate summary options**: 1. use GCP STT, 2. gemini different models, 3. other alternate open-source models, 4. native gemini app through prompt injection.
* Use vector search to verse id locally
* **add alternate audio trimming options**: trim audio or send the entire audio ✅
* **database**: use mongodb
* **logging**: implement error logging mechanism
* **deployment**
* **sumamariser**: improve the summariser system instruction to account for the other verses. Add options to view verse only, summary only, transiteration (?) along with the same options for the entire surah
* **TTS** IMPORTANT
* **add interface to activate recording on the frontend**: use browser's media recorder api to record audio and send it to the backend. refer to roadmap ✅
* **Add multi-lang support (nepali, hindi and urdu) for output** ✅
* **Empty audio handling**
* **More Trimming Options**
* **Update System Instruction**: use separate instructions based on whether the audio is trimmed or not. Use exact verses for non-trimmed audio. Use margin of 100% on either side for trimmed audio 