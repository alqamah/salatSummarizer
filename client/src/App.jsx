import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, FileAudio, Loader2, PlayCircle, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import './index.css';
import RecordHandler from './recordHandler';

function App() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [processingOption, setProcessingOption] = useState('gcp_gemini');
  const [doNotTrim, setDoNotTrim] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Applying FFmpeg filters...');
  const [clientId] = useState(() => Date.now().toString() + Math.random().toString(36).substring(2));
  const [inputMode, setInputMode] = useState('upload');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('audio/')) {
        setError('Please select a valid audio file.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('audio/')) {
        setFile(droppedFile);
        setError(null);
        setResult(null);
      } else {
        setError('Please drop a valid audio file.');
      }
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setStatusMessage('Starting upload...');

    const eventSource = new EventSource(`http://localhost:3001/api/status?clientId=${clientId}`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatusMessage(data.status);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('clientId', clientId);
    formData.append('processingOption', processingOption);
    formData.append('doNotTrim', doNotTrim);

    try {
      const response = await axios.post('http://localhost:3001/api/process-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        setResult(response.data);
      } else {
        setError(response.data.error || 'Failed to process audio.');
      }
    } catch (err) {
      if (err.response?.data) {
        const { error: mainErr, details, fullError } = err.response.data;
        setError(`${mainErr || 'Error'}${details ? ' – ' + details : ''}${fullError ? ' | ' + fullError : ''}`);
      } else {
        setError(err.message || 'An error occurred during upload or processing.');
      }
    } finally {
      setIsUploading(false);
      eventSource.close();
    }
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1>Salat <em>Summary</em></h1>
      </header>

      <main>
        <div className="input-mode-toggle">
          <button
            className={`mode-btn ${inputMode === 'upload' ? 'active' : ''}`}
            onClick={() => setInputMode('upload')}
            type="button"
          >
            Upload Audio
          </button>
          <button
            className={`mode-btn ${inputMode === 'record' ? 'active' : ''}`}
            onClick={() => setInputMode('record')}
            type="button"
          >
            Record Audio
          </button>
        </div>

        {/* Upload or Record panel */}
        {inputMode === 'upload' ? (
          <section
            className={`upload-zone glass-panel ${file ? 'has-file' : ''} ${isUploading ? 'uploading' : ''}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="audio/*"
              style={{ display: 'none' }}
              disabled={isUploading}
            />
            <div className="upload-content">
              {isUploading ? (
                <div className="status-indicator">
                  <Loader2 className="icon spin" size={52} />
                  <h3>Processing Audio…</h3>
                  <p>{statusMessage}</p>
                </div>
              ) : file ? (
                <div className="status-indicator">
                  <FileAudio className="icon text-primary" size={52} />
                  <h3>{file.name}</h3>
                  <p>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to process</p>
                </div>
              ) : (
                <div className="status-indicator">
                  <Upload className="icon" size={52} />
                  <h3>Click or drag to upload</h3>
                  <p>Supports MP3, WAV, M4A up to 50 MB</p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <RecordHandler
            onRecordingComplete={(recordedFile) => {
              setFile(recordedFile);
              setError(null);
              setResult(null);
              setInputMode('upload');
            }}
          />
        )}

        {/* Error banner */}
        {error && (
          <div className="error-message">
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Processing options */}
        {file && !isUploading && !result && (
          <div className="options-container glass-panel">
            <div className="options-grid">
              <div className="processing-options">
                <h4 className="options-section-title">Processing Method</h4>
                <label>
                  <input
                    type="radio"
                    value="gcp_gemini"
                    checked={processingOption === 'gcp_gemini'}
                    onChange={(e) => setProcessingOption(e.target.value)}
                  />
                  GCP Speech-to-Text → Gemini Summary
                </label>
                <label>
                  <input
                    type="radio"
                    value="gemini_direct"
                    checked={processingOption === 'gemini_direct'}
                    onChange={(e) => setProcessingOption(e.target.value)}
                  />
                  Send audio directly to Gemini
                </label>
              </div>

              <div className="trim-option">
                <h4 className="options-section-title">Audio Settings</h4>
                <label>
                  <input
                    type="checkbox"
                    checked={doNotTrim}
                    onChange={(e) => setDoNotTrim(e.target.checked)}
                  />
                  Do not trim audio
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Process button */}
        {file && !isUploading && !result && (
          <button className="btn-primary" onClick={uploadFile}>
            ✦ Process Recording
          </button>
        )}

        {/* Results */}
        {result && (
          <div className="results-container">
            <div className="result-card success-header">
              <CheckCircle2 size={24} className="text-success" />
              <h2>Processing Complete</h2>
            </div>

            <div className="result-card">
              <div className="card-header">
                <PlayCircle size={20} className="text-primary" />
                <h3>Enhanced Audio</h3>
              </div>
              <div className="card-body">
                <audio controls className="audio-player" src={result.processedAudioUrl}>
                  Your browser does not support the audio element.
                </audio>
                <div className="audio-actions">
                  <a href={result.processedAudioUrl} download className="btn-secondary">
                    Download File
                  </a>
                </div>
              </div>
            </div>

            {result.transcript && (
              <div className="result-card">
                <div className="card-header">
                  <FileText size={20} className="text-primary" />
                  <h3>Transcription</h3>
                </div>
                <div className="card-body">
                  <div className="transcription-text rtl">{result.transcript}</div>
                </div>
              </div>
            )}

            {result.summary && (
              <div className="result-card">
                <div className="card-header">
                  <FileText size={20} className="text-primary" />
                  <h3>AI Summary &amp; Insights</h3>
                </div>
                <div className="card-body">
                  <div className="transcription-text">{result.summary}</div>
                </div>
              </div>
            )}

            {result.aiError && (
              <div className="error-message">
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <span>AI processing encountered an error: {result.aiError}</span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
