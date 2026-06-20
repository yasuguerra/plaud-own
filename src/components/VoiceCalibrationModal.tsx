import React, { useState, useRef } from 'react';

interface VoiceCalibrationModalProps {
  onClose: () => void;
  userId: string;
}

export function VoiceCalibrationModal({ onClose, userId }: VoiceCalibrationModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); // Fallback to webm, will be converted on backend if necessary
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error("Microphone error:", err);
      setError("No se pudo acceder al micrófono. Verifica los permisos de tu navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    audioChunksRef.current = [];
  };

  const saveCalibration = async () => {
    if (!audioBlob) return;
    
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'calibration.webm');

      const response = await fetch('/api/users/calibration', {
        method: 'POST',
        headers: {
          'x-user-id': userId
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Fallo en la subida al servidor.');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      console.error("Upload error:", err);
      setError("Error al guardar el perfil de voz. Inténtalo de nuevo.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full text-white">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Calibración de Voz
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-xl text-emerald-400">¡Perfil de voz guardado!</p>
            <p className="text-sm text-slate-400 mt-2">Ahora identificaremos tu voz automáticamente en tus reuniones.</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-6">
            <p className="text-slate-300">
              Para que la IA pueda identificar automáticamente cuándo hablas tú en las reuniones, por favor lee el siguiente texto en voz alta con tu tono de voz normal:
            </p>

            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 text-slate-200 italic shadow-inner">
              "Hola, estoy grabando esta muestra de audio como referencia para que el sistema reconozca mi voz automáticamente en todas mis reuniones futuras y pueda asignarme mis tareas correspondientes."
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <div className="flex flex-col items-center justify-center space-y-4 pt-4">
              {!audioBlob ? (
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 ${
                    isRecording 
                      ? "bg-red-500/20 text-red-500 animate-pulse border border-red-500/50" 
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/30"
                  }`}
                >
                  {isRecording ? (
                    <div className="w-6 h-6 bg-red-500 rounded-sm"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ) : (
                <div className="flex items-center space-x-4 w-full">
                  <button 
                    onClick={resetRecording}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    disabled={isUploading}
                  >
                    Re-grabar
                  </button>
                  <button 
                    onClick={saveCalibration}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-medium rounded-lg shadow-lg transition-all flex justify-center items-center"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Guardando perfil...
                      </>
                    ) : (
                      "Guardar Mi Perfil de Voz"
                    )}
                  </button>
                </div>
              )}
              
              <p className="text-slate-500 text-sm">
                {isRecording ? "Grabando... haz clic en el cuadro para detener." : audioBlob ? "Escucha y guarda tu perfil." : "Haz clic para empezar a grabar."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}