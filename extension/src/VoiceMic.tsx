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
      const response = await fetch('http://127.0.0.1:8787/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      if (data.transcript) {
        onTranscript(data.transcript);
      }
    } catch (error) {
      console.error("Transcription failed:", error);
      alert("Transcription failed. Check console for details.");
    }
  };

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      title={isRecording ? "Stop Recording" : "Voice Ask"}
      style={{
        minWidth: '32px',
        minHeight: '32px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        background: isRecording ? '#ef4444' : '#f3f4f6',
        color: isRecording ? 'white' : '#4b5563',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem'
      }}
    >
      {isProcessing ? '...' : (isRecording ? '⏹' : '🎙️')}
    </button>
  );
};