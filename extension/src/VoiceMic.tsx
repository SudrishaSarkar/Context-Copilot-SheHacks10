import React, { useState, useRef } from 'react';

interface VoiceMicProps {
  onTranscript: (text: string) => void;
}

export const VoiceMic: React.FC<VoiceMicProps> = ({ onTranscript }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        // Create blob from chunks
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsProcessing(true);
        await sendAudio(blob);
        setIsProcessing(false);
        setIsRecording(false);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      
      // Only prompt for new tab if it's a permission issue
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        const shouldOpen = confirm("Microphone access is required. Chrome cannot show permission prompts inside a popup.\n\nOpen in a new tab to grant permission?");
        if (shouldOpen) {
          chrome.tabs.create({ url: window.location.href });
        }
      } else {
        alert(`Microphone error: ${err.message || "Unknown error"}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const sendAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const response = await fetch('http://localhost:8787/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();
      console.log("Transcription response:", data);
      if (data.transcript && data.transcript.trim()) {
        console.log("Calling onTranscript with:", data.transcript);
        onTranscript(data.transcript);
      } else {
        console.warn("Empty or missing transcript in response:", data);
        alert("No transcript received. Please try recording again.");
      }
    } catch (error) {
      console.error("Transcription failed:", error);
      alert(`Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`mic-button ${isRecording ? 'recording' : ''}`}
      title={isRecording ? "Stop Recording" : "Voice Ask"}
      style={{
        minWidth: '32px',
        minHeight: '32px',
        borderRadius: '50%',
        border: 'none',
        cursor: isProcessing ? 'not-allowed' : 'pointer',
        background: isRecording ? '#ef4444' : '#f3f4f6',
        color: isRecording ? 'white' : '#4b5563',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        zIndex: 10,
        transition: 'all 0.2s',
      }}
    >
      {isProcessing ? '...' : (isRecording ? '⏹' : '🎙️')}
      {isRecording && <span className="recording-dot"></span>}
    </button>
  );
};
