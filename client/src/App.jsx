import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, FileAudio, Loader2, PlayCircle, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
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

    const formData = new FormData();
    formData.append('audio', file);

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
      console.error(err);
      setError(err.response?.data?.error || err.response?.data?.details || 'An error occurred during upload or processing.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Audio Enhancer</h1>
        <p>Upload your MP3 to enhance recordings instantly.</p>
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
                <p>Applying FFmpeg filters.</p>
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
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
