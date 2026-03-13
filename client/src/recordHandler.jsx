import React, { useState, useRef } from 'react';
import { Mic, Square, Send, RefreshCw } from 'lucide-react';

const RecordHandler = ({ onRecordingComplete }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const type = mediaRecorderRef.current.mimeType;
                const blob = new Blob(chunksRef.current, { type });
                setAudioBlob(blob);
                chunksRef.current = [];
                stream.getTracks().forEach((t) => t.stop());
            };

            chunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setAudioBlob(null);
        } catch {
            alert('Could not access microphone. Please check browser permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleSend = () => {
        if (audioBlob && onRecordingComplete) {
            const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
            const file = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type });
            onRecordingComplete(file);
        }
    };

    return (
        <div className="interactive-glass-card record-handler">
            {/* Idle state — not recording, nothing saved */}
            {!isRecording && !audioBlob && (
                <>
                    <div className="status-indicator">
                        <Mic className="icon text-primary" size={52} />
                        <h3>Record Audio</h3>
                        <div className="instruction-group">
                            <p>Click <strong>Start</strong> at the beginning of your prayer to begin recording.</p>
                            <p>Once finished, click <strong>Stop</strong> to finalize the audio.</p>
                        </div>
                    </div>
                    <button className="btn-primary" onClick={startRecording} type="button">
                        <Mic size={18} /> Start Recording
                    </button>
                </>
            )}

            {/* Recording state */}
            {isRecording && (
                <>
                    <div className="status-indicator">
                        <Mic className="icon recording-pulse" size={52} style={{ color: '#c0392b' }} />
                        <h3>Recording…</h3>
                        <p>Speak clearly. Press stop when done.</p>
                    </div>
                    <button className="btn-danger" onClick={stopRecording} type="button">
                        <Square size={18} /> Stop Recording
                    </button>
                </>
            )}

            {/* Saved state — preview and send */}
            {audioBlob && !isRecording && (
                <div className="recording-actions">
                    <div className="status-indicator">
                        <Mic className="icon text-primary" size={52} />
                        <h3>Recording Ready</h3>
                        <p>Preview your recording, then use it or re-record.</p>
                    </div>

                    <audio
                        src={URL.createObjectURL(audioBlob)}
                        controls
                        className="audio-player"
                    />

                    <div className="recording-buttons">
                        <button className="btn-secondary" onClick={startRecording} type="button">
                            <RefreshCw size={16} /> Re-record
                        </button>
                        <button className="btn-primary" style={{ marginBottom: 0 }} onClick={handleSend} type="button">
                            <Send size={16} /> Use Recording
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecordHandler;
