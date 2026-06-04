import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

interface AudioRecorderProps {
  onAudioReady: (base64Data: string, mimeType: string, durationSec: number, localUrl?: string) => void;
  isProcessing: boolean;
}

export default function AudioRecorder({ onAudioReady, isProcessing }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  const startTimer = () => {
    setRecordingTime(0);
    recordingTimeRef.current = 0;
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => {
        const next = prev + 1;
        recordingTimeRef.current = next;
        return next;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    setError(null);
    setAudioUrl(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine the best supported mime type
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg";
      } else if (MediaRecorder.isTypeSupported("audio/wav")) {
        mimeType = "audio/wav";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Terminate mic stream tracks
        stream.getTracks().forEach((track) => track.stop());

        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const resultBase64 = reader.result as string;
          // Extract base64 payload out of DataURL (strips headers like "data:audio/webm;base64,")
          const base64Data = resultBase64.split(",")[1];
          onAudioReady(base64Data, mimeType, recordingTimeRef.current, url);
        };
      };

      mediaRecorder.start(250); // Slice every 250ms
      setIsRecording(true);
      startTimer();
    } catch (err: any) {
      console.error("Microphone device system error:", err);
      setError("Unable to access microphone. Please check permissions in your browser bar.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  const formatTime = (timeInSecs: number) => {
    const minutes = Math.floor(timeInSecs / 60);
    const seconds = timeInSecs % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const clearAudio = () => {
    setAudioUrl(null);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" id="voice-recorder-widget">
      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          <h3 className="font-sans text-sm font-semibold text-slate-800">Direct Voice Record</h3>
        </div>
        {isRecording && (
          <span className="font-mono text-xs font-semibold text-red-500 animate-pulse bg-red-50 px-2 py-0.5 rounded-full">
            {formatTime(recordingTime)}
          </span>
        )}
      </div>

      <div className="my-6 flex flex-col items-center justify-center">
        {isRecording ? (
          <div className="flex flex-col items-center gap-4">
            {/* Visualizer bars */}
            <div className="flex items-end justify-center gap-1.5 h-16 w-full max-w-xs px-4">
              {[...Array(14)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-amber-500 animate-pulse"
                  style={{
                    height: `${20 + Math.random() * 80}%`,
                    animationDelay: `${i * 0.08}s`,
                    animationDuration: '0.6s'
                  }}
                />
              ))}
            </div>

            <button
              onClick={stopRecording}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition duration-150 active:scale-95"
              title="Stop Recording"
              id="stop-rec-btn"
            >
              <Square className="h-5 w-5 fill-white" />
            </button>
            <p className="font-sans text-xs text-slate-500">Click to finish and process notes</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {audioUrl ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <audio src={audioUrl} controls className="w-full max-w-sm rounded-lg" />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={clearAudio}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition duration-150"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Reset Audio
                  </button>
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready to summarize
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isProcessing}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600 transition duration-150 active:scale-95 disabled:bg-slate-100 disabled:text-slate-400"
                  title="Start Recording"
                  id="start-rec-btn"
                >
                  <Mic className="h-7 w-7" />
                </button>
                <div className="text-center">
                  <span className="text-sm font-medium text-slate-700 block">Record Lecture Note</span>
                  <span className="text-xs text-slate-400">Capture spoken presentation live to study</span>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
