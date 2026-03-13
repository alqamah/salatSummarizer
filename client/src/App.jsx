import React, { useState, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Upload, FileAudio, Loader2, PlayCircle, FileText, CheckCircle2, AlertCircle, BookOpen, List } from 'lucide-react';
import './index.css';
import RecordHandler from './recordHandler';

// Parse Gemini's structured MD response into the three named sections
function parseGeminiSections(text) {
  if (!text) return null;
  const result = { surahInfo: '', tafseer: '', verses: '', raw: text };
  const parts = text.split(/(?=###\s)/);
  for (const part of parts) {
    if (/###\s*Surah Information/i.test(part))   result.surahInfo = part.trim();
    else if (/###\s*Summary Section/i.test(part)) result.tafseer  = part.trim();
    else if (/###\s*Original Text/i.test(part))   result.verses   = part.trim();
  }
  const hasSections = result.surahInfo || result.tafseer || result.verses;
  return hasSections ? result : null;
}

// Extract Arabic/English pairs from the verses section text
// Expects lines like:  **Ayah N:** [Arabic]  and  **Translation:** [English]
function parseVerses(versesText) {
  if (!versesText) return [];
  const lines = versesText.split('\n');
  const verses = [];
  let current = {};
  for (const line of lines) {
    const trimmed = line.trim();
    // Match **Ayah N:** Arabic (bold label with number)
    const ayahMatch = trimmed.match(/^\*\*Ayah\s+\d+:\*\*\s*(.+)/);
    // Match **Translation:** English
    const transMatch = trimmed.match(/^\*\*Translation:\*\*\s*(.+)/);
    if (ayahMatch) {
      if (current.arabic) verses.push(current); // flush previous
      current = { arabic: ayahMatch[1].trim() };
    } else if (transMatch && current.arabic) {
      current.english = transMatch[1].trim();
      verses.push(current);
      current = {};
    }
  }
  if (current.arabic) verses.push(current); // flush last
  return verses;
}

// Custom dropdown that inherits the app's font and theming (native <select> options can't be styled)
function CustomSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => o.value === value);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="custom-select" style={{ position: 'relative' }}>
      <button
        type="button"
        className={`custom-select__trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label}</span>
        <svg className="custom-select__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <ul className="custom-select__menu" role="listbox">
          {options.map(opt => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`custom-select__option ${opt.value === value ? 'selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [processingOption, setProcessingOption] = useState('gemini_direct');
  const [doNotTrim, setDoNotTrim] = useState(false);
  const [language, setLanguage] = useState('English');
  const [statusMessage, setStatusMessage] = useState('Applying FFmpeg filters...');
  const [clientId] = useState(() => Date.now().toString() + Math.random().toString(36).substring(2));
  const [inputMode, setInputMode] = useState('record');
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

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const eventSource = new EventSource(`${apiUrl}/api/status?clientId=${clientId}`);
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
    formData.append('language', language);

    try {
      const response = await axios.post(`${apiUrl}/api/process-audio`, formData, {
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
            className={`mode-btn ${inputMode === 'record' ? 'active' : ''}`}
            onClick={() => setInputMode('record')}
            type="button"
          >
            Record Audio
          </button>
          <button
            className={`mode-btn ${inputMode === 'upload' ? 'active' : ''}`}
            onClick={() => setInputMode('upload')}
            type="button"
          >
            Upload Audio
          </button>
        </div>

        {/* Record or Upload panel */}
        {inputMode === 'record' ? (
          <RecordHandler
            onRecordingComplete={(recordedFile) => {
              setFile(recordedFile);
              setError(null);
              setResult(null);
              setInputMode('upload');
            }}
          />
        ) : (
          <section
            className={`interactive-glass-card upload-zone ${file ? 'has-file' : ''} ${isUploading ? 'uploading' : ''}`}
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
                  <p>Upload the recorded Namaz Audio file here.</p>
                  <p>Supports MP3, WAV, M4A up to 50 MB</p>
                </div>
              )}
            </div>
          </section>
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
                {/* Method 2 (temporarily disabled): GCP STT  -> Vector Search -> Tafseer API*/}
                <label>
                  <input
                    type="radio"
                    value="gemini_direct"
                    checked={processingOption === 'gemini_direct'}
                    onChange={(e) => setProcessingOption(e.target.value)}
                  />
                  Method 1: Using Gemini 2.5 Flash
                </label>
                {/* Method 2 (temporarily disabled): GCP STT  -> Vector Search -> Tafseer API*/}
                <label className="disabled">
                  <input
                    disabled
                    style={{ opacity: 0.5 }}
                    className="disabled"
                    type="radio"
                    value="gcp_stt"
                    checked={processingOption === 'gcp_stt'}
                    onChange={(e) => setProcessingOption(e.target.value)}
                  />
                  <p>Method 2: Using GCP STT & Vector Search</p>
                </label>

              </div>

              <div className="trim-option">
                <h4 className="options-section-title">Output Language</h4>
                <div style={{ padding: '0.25rem 0' }}>
                  <CustomSelect
                    value={language}
                    onChange={setLanguage}
                    options={[
                      { value: 'English', label: 'English' },
                      { value: 'Urdu', label: 'Urdu' },
                      { value: 'Hindi', label: 'Hindi' },
                      { value: 'Nepali', label: 'Nepali' },
                    ]}
                  />
                </div>
                
                <h4 className="options-section-title" style={{ marginTop: '1rem' }}>Audio Settings</h4>
                <label>
                  <input
                    type="checkbox"
                    checked={doNotTrim}
                    onChange={(e) => setDoNotTrim(e.target.checked)}
                  />
                  Do Not Trim Audio (incurs higher processing cost)
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
        {result && (() => {
          const sections = parseGeminiSections(result.summary);
          return (
            <div className="results-container">
              <div className="result-card success-header">
                <CheckCircle2 size={24} className="text-success" />
                <h2>Processing Complete</h2>
              </div>

              {/* Enhanced Audio */}
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
                    <a href={result.processedAudioUrl} download className="btn-secondary">Download File</a>
                  </div>
                </div>
              </div>

              {/* ── Parsed Gemini sections ── */}
              {sections ? (
                <>
                  {/* Section 1: Surah Information */}
                  {sections.surahInfo && (
                    <div className="result-card">
                      <div className="card-header">
                        <BookOpen size={20} className="text-primary" />
                        <h3>Surah Information</h3>
                      </div>
                      <div className="card-body markdown-body">
                        <ReactMarkdown>{sections.surahInfo.replace(/^###\s*Surah Information\s*/i, '')}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Section 2: Summary / Tafseer */}
                  {sections.tafseer && (
                    <div className="result-card">
                      <div className="card-header">
                        <FileText size={20} className="text-primary" />
                        <h3>Summary &amp; Tafseer</h3>
                      </div>
                      <div className="card-body markdown-body">
                        <ReactMarkdown>{sections.tafseer.replace(/^###\s*Summary Section.*?\n/i, '')}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Section 3: Original Text & Translation — custom two-column layout */}
                  {sections.verses && (() => {
                    const verseList = parseVerses(sections.verses);
                    return verseList.length > 0 ? (
                      <div className="result-card">
                        <div className="card-header">
                          <List size={20} className="text-primary" />
                          <h3>Original Text &amp; Translation</h3>
                        </div>
                        <div className="card-body verses-body">
                          {verseList.map((v, i) => (
                            <div key={i} className="verse-pair">
                              <div className="verse-arabic">{v.arabic}</div>
                              <div className="verse-english">{v.english}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Fallback if parsing found no pairs — render raw MD */
                      <div className="result-card">
                        <div className="card-header">
                          <List size={20} className="text-primary" />
                          <h3>Original Text &amp; Translation</h3>
                        </div>
                        <div className="card-body markdown-body">
                          <ReactMarkdown>{sections.verses.replace(/^###\s*Original Text.*?\n/i, '')}</ReactMarkdown>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : result.summary && (
                /* Fallback: render full response as a single MD card if parsing didn't find sections */
                <div className="result-card">
                  <div className="card-header">
                    <FileText size={20} className="text-primary" />
                    <h3>AI Summary &amp; Insights</h3>
                  </div>
                  <div className="card-body markdown-body">
                    <ReactMarkdown>{result.summary}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* AI Error */}
              {result.aiError && (
                <div className="error-message" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={20} style={{ flexShrink: 0 }} />
                    <span><strong>Summary failed:</strong> {result.aiError}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.9 }}>
                    Try refreshing the page and retrying. If the issue persists, the audio may be unclear or silent.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      onClick={() => window.location.reload()}
                    >
                      ↺ Refresh Page
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      onClick={() => {
                        setResult(null);
                        setError(null);
                      }}
                    >
                      ↺ Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </main>
    </div>
  );
}

export default App;
