import React, { useState } from 'react';
import { Share2, Copy, CheckCircle2, Globe, Lock, Loader2, Link } from 'lucide-react';
import { StudySession } from '../types';

interface ShareModalProps {
  session: StudySession;
  onClose: () => void;
  onToggleShare: (isShared: boolean) => Promise<{ success: boolean; shareId?: string | null }>;
}

export default function ShareModal({ session, onClose, onToggleShare }: ShareModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const shareUrl = session.shareId 
    ? `${window.location.origin}/?shareId=${session.shareId}`
    : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleToggle = async (newState: boolean) => {
    setIsLoading(true);
    try {
      await onToggleShare(newState);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full flex flex-col p-6 animate-scale-up">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Compartir Minuta</h2>
              <p className="text-[11px] text-slate-500 font-medium">Gestionar acceso público</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-full transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {session.isShared ? (
                <Globe className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <Lock className="h-5 w-5 text-slate-400 shrink-0" />
              )}
              <div>
                <span className="block text-sm font-bold text-slate-800">
                  {session.isShared ? "Enlace Público Activo" : "Acceso Privado"}
                </span>
                <span className="block text-xs text-slate-500">
                  {session.isShared 
                    ? "Cualquiera con el enlace puede leer esta minuta." 
                    : "Solo tú tienes acceso a esta minuta."}
                </span>
              </div>
            </div>

            <button
              disabled={isLoading}
              onClick={() => handleToggle(!session.isShared)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                session.isShared ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
              role="switch"
              aria-checked={session.isShared}
            >
              <span className="sr-only">Toggle share status</span>
              {isLoading ? (
                <span className={`pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${session.isShared ? 'translate-x-5' : 'translate-x-0'}`}>
                  <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    session.isShared ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              )}
            </button>
          </div>

          {session.isShared && shareUrl && (
            <div className="space-y-2 animate-fade-in">
              <label className="block text-xs font-bold text-slate-700">Enlace de la Minuta</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 overflow-hidden">
                  <Link className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
                  <span className="text-xs text-slate-600 truncate select-all">{shareUrl}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer ${
                    isCopied 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                      : 'bg-indigo-600 border border-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}