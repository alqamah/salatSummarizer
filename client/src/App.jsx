import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, FileAudio, Loader2, PlayCircle, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [processingOption, setProcessingOption] = useState('gcp_gemini');
  const [doNotTrim, setDoNotTrim] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Applying FFmpeg filters...');
  const [clientId] = useState(() => Date.now().toString() + Math.random().toString(36).substring(2));
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

  const handleDragOver = (e) => {
    e.preventDefault();
  };

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
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setResult(response.data);
      } else {
        setError(response.data.error || 'Failed to process audio.');
      }
    } catch (err) {
      if (err.response?.data) {
        const { error: mainErr, details, fullError } = err.response.data;
        setError(`${mainErr || 'Error'}${details ? ' - Details: ' + details : ''}${fullError ? ' | ' + fullError : ''}`);
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
      <header className="header">
      </header>

      <main className="main-content">
        <section
          className={`upload-zone ${file ? 'has-file' : ''} ${isUploading ? 'uploading' : ''}`}
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
                <Loader2 className="icon spin" size={48} />
                <h3>Processing Audio...</h3>
                <p>{statusMessage}</p>
              </div>
            ) : file ? (
              <div className="status-indicator success">
                <FileAudio className="icon text-primary" size={48} />
                <h3>{file.name}</h3>
                <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="status-indicator">
                <Upload className="icon" size={48} />
                <h3>Click or drag to upload</h3>
                <p>Supports MP3, WAV, M4A up to 50MB</p>
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="error-message">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {file && !isUploading && !result && (
          <div className="options-container" style={{ margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: 'var(--surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div className="processing-options" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Processing Option</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="gcp_gemini"
                  checked={processingOption === 'gcp_gemini'}
                  onChange={(e) => setProcessingOption(e.target.value)}
                />
                Option 1: GCP for STT -&gt; Gemini for Summary
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="gemini_direct"
                  checked={processingOption === 'gemini_direct'}
                  onChange={(e) => setProcessingOption(e.target.value)}
                />
                Option 2: Send trimmed audio directly to Gemini
              </label>
            </div>

            <div className="trim-option" style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Audio Settings</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={doNotTrim}
                  onChange={(e) => setDoNotTrim(e.target.checked)}
                />
                Do not trim audio
              </label>
            </div>
          </div>
        )}

        {file && !isUploading && !result && (
          <button className="btn-primary" onClick={uploadFile}>
            Process Recording
          </button>
        )}

        {result && (
          <div className="results-container">
            <div className="result-card success-header">
              <CheckCircle2 size={24} className="text-success" />
              <h2>Processing Complete</h2>
            </div>

            <div className="result-card">
              <div className="card-header">
                <PlayCircle size={20} />
                <h3>Enhanced Audio</h3>
              </div>
              <div className="card-body">
                <audio controls className="audio-player" src={result.processedAudioUrl}>
                  Your browser does not support the audio element.
                </audio>
                <div className="audio-actions">
                  <a href={result.processedAudioUrl} download className="btn-secondary">Download Enhanced File</a>
                </div>
              </div>
            </div>

            {result.transcript && (
              <div className="result-card">
                <div className="card-header">
                  <FileText size={20} />
                  <h3>Transcription</h3>
                </div>
                <div className="card-body">
                  <div className="transcription-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', textAlign: 'right', direction: 'rtl' }}>
                    {result.transcript}
                  </div>
                </div>
              </div>
            )}

            {result.summary && (
              <div className="result-card">
                <div className="card-header">
                  <FileText size={20} />
                  <h3>AI Summary & Insights</h3>
                </div>
                <div className="card-body">
                  <div className="transcription-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                    {result.summary}
                  </div>
                </div>
              </div>
            )}

            {result.aiError && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                <AlertCircle size={20} />
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
