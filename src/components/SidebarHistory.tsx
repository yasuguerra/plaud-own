import React from "react";
import { FolderHeart, Trash2, Calendar, FileAudio, FileVideo, ChevronRight, FileText, BookOpen } from "lucide-react";
import { StudySession } from "../types";

interface SidebarHistoryProps {
  sessions: StudySession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

export default function SidebarHistory({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}: SidebarHistoryProps) {
  const getFormattedDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Study block";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 p-5 shadow-sm" id="sidebar-history-component">
      <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
        <FolderHeart className="h-5 w-5 text-indigo-500" />
        <div>
          <h2 className="font-sans text-sm font-bold text-slate-800">Historial de Minutas</h2>
          <p className="font-sans text-[10px] text-slate-400">Gestión de sesiones guardadas</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 max-h-[360px] pr-1">
        {sessions.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <span className="text-xs block font-medium">Historial vacío</span>
            <span className="text-[10px] text-slate-400 block mt-1">Sube un archivo, graba audio o carga un demo para registrar la primera reunión.</span>
          </div>
        ) : (
          sessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            return (
              <div
                key={sess.id}
                onClick={() => onSelectSession(sess.id)}
                className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition duration-150 ${
                  isActive
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100/50 hover:border-slate-200"
                }`}
                id={`session-item-${sess.id}`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span className={`p-1.5 rounded-lg shrink-0 ${isActive ? "bg-white/10 text-white" : "bg-white text-slate-400 border border-slate-100"}`}>
                    {sess.mediaType === "video" ? (
                      <FileVideo className="h-4 w-4" />
                    ) : sess.mediaType === "pdf" ? (
                      <BookOpen className={`h-4 w-4 ${isActive ? "text-red-300" : "text-red-500"}`} />
                    ) : sess.mediaType === "document" ? (
                      <FileText className={`h-4 w-4 ${isActive ? "text-emerald-300" : "text-emerald-500"}`} />
                    ) : (
                      <FileAudio className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <span className={`font-sans text-xs font-bold block truncate leading-tight ${isActive ? "text-white" : "text-slate-800"}`}>
                      {sess.title || sess.mediaName}
                    </span>
                    <span className={`font-sans text-[9px] flex items-center gap-1 mt-0.5 ${isActive ? "text-slate-350 text-white/70" : "text-slate-400"}`}>
                      <Calendar className="h-3 w-3 shrink-0" />
                      {getFormattedDate(sess.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={(e) => onDeleteSession(sess.id, e)}
                    className={`p-1 rounded-lg transition opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 ${
                      isActive ? "text-white/40 hover:bg-white/10 hover:text-rose-400" : "text-slate-300"
                    }`}
                    title="Eliminar sesión"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white/40" : "text-slate-305 text-slate-300"}`} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
