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
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const type = mediaRecorderRef.current.mimeType;
                const blob = new Blob(chunksRef.current, { type });
                setAudioBlob(blob);
                chunksRef.current = [];

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            chunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setAudioBlob(null);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please check permissions.');
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
        <div className="record-handler">
            {!isRecording && !audioBlob && (
                <>
                    <div className="status-indicator" style={{ marginBottom: '1rem' }}>
                        <Mic className="icon text-primary" size={48} />
                        <h3>Record Audio</h3>
                        <p>Click start to begin recording</p>
                    </div>
                    <button className="btn-primary" onClick={startRecording} type="button">
                        <Mic size={20} /> Start Recording
                    </button>
                </>
            )}

            {isRecording && (
                <>
                    <div className="status-indicator" style={{ marginBottom: '1rem' }}>
                        <Mic className="icon" size={48} style={{ color: 'var(--danger)' }} />
                        <h3>Recording...</h3>
                        <p>Speak now</p>
                    </div>
                    <button className="btn-danger" onClick={stopRecording} type="button">
                        <Square size={20} /> Stop Recording
                    </button>
                </>
            )}

            {audioBlob && !isRecording && (
                <div className="recording-actions">
                    <div className="status-indicator success" style={{ marginBottom: '1rem' }}>
                        <Mic className="icon text-primary" size={48} />
                        <h3>Recording Saved</h3>
                        <p>Ready to process</p>
                    </div>
                    <audio src={URL.createObjectURL(audioBlob)} controls className="audio-player" />
                    <div className="recording-buttons">
                        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flex: 1, padding: '1rem' }} onClick={startRecording} type="button">
                            <RefreshCw size={18} /> Re-record
                        </button>
                        <button className="btn-primary" style={{ marginBottom: 0, flex: 1 }} onClick={handleSend} type="button">
                            <Send size={18} /> Use Recording
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecordHandler;
