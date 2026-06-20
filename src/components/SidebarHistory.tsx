import React, { useState } from "react";
import { FolderHeart, Trash2, Calendar, FileAudio, FileVideo, ChevronRight, FileText, BookOpen, Mic, FolderOpen, Folder } from "lucide-react";
import { StudySession, TopicFolder } from "../types";
import { VoiceCalibrationModal } from "./VoiceCalibrationModal";

interface SidebarHistoryProps {
  sessions: StudySession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  folders: TopicFolder[];
  activeFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => void;
  onMoveSession: (sessionId: string, folderId: string | null) => void;
}

export default function SidebarHistory({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onMoveSession
}: SidebarHistoryProps) {
  const [showCalibration, setShowCalibration] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const userId = "guest"; // FIXME: Reemplazar con el ID real del usuario logueado desde el contexto de Auth

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    e.dataTransfer.setData("sessionId", sessionId);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const sessionId = e.dataTransfer.getData("sessionId");
    if (sessionId) {
      onMoveSession(sessionId, folderId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getFormattedDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Study block";
    }
  };

  const renderSessionItem = (sess: StudySession) => {
    const isActive = sess.id === activeSessionId;
    return (
      <div
        key={sess.id}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, sess.id)}
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
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white/40" : "text-slate-300"}`} />
        </div>
      </div>
    );
  };

  const unfiledSessions = sessions.filter(s => !s.folderId);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 p-5 shadow-sm" id="sidebar-history-component">
      <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <FolderHeart className="h-5 w-5 text-indigo-500" />
          <div>
            <h2 className="font-sans text-sm font-bold text-slate-800">Historial</h2>
            <p className="font-sans text-[10px] text-slate-400">Minutas y carpetas</p>
          </div>
        </div>
        <button 
          onClick={() => {
            const name = prompt("Nombre de la nueva carpeta:");
            if (name && name.trim()) onCreateFolder(name);
          }}
          className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition cursor-pointer"
        >
          + Nueva
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 max-h-[360px] pr-1">
        
        {/* Global / Home Button */}
        <div 
          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${activeFolderId === null && activeSessionId === null ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' : 'hover:bg-slate-50 text-slate-700 border border-transparent'}`}
          onClick={() => {
            onSelectFolder(null);
            onSelectSession(""); // clear session too, though we only have SelectFolder in this component to easily do it?
            // Actually, we don't have a clear session function passed down cleanly except passing "" which might break if not handled.
            // Let's just clear folder ID for now to see the ingestion card.
            onSelectFolder(null);
          }}
        >
          <FolderHeart className="h-4 w-4" />
          <span className="font-sans text-xs font-bold">Resumen Global</span>
        </div>

        {/* Folders */}
        {folders.map(folder => {
          const folderSessions = sessions.filter(s => s.folderId === folder.id);
          const isExpanded = expandedFolders[folder.id];
          const isFolderActive = activeFolderId === folder.id;

          return (
            <div 
              key={folder.id} 
              className="space-y-2"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, folder.id)}
            >
              <div 
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${isFolderActive ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => onSelectFolder(folder.id)}
              >
                <div className="flex items-center gap-2 text-slate-700">
                  {isExpanded ? <FolderOpen className="h-4 w-4 text-indigo-500" /> : <Folder className="h-4 w-4 text-indigo-400" />}
                  <span className={`font-sans text-xs font-bold ${isFolderActive ? 'text-indigo-800' : ''}`}>{folder.name}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{folderSessions.length}</span>
                </div>
                <button 
                  className="p-1 hover:bg-slate-200 rounded-md text-slate-400"
                  onClick={(e) => toggleFolder(folder.id, e)}
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
              </div>

              {isExpanded && (
                <div className="pl-4 space-y-2 border-l-2 border-slate-100 ml-2">
                  {folderSessions.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic py-2">Carpeta vacía. Arrastra una sesión aquí.</p>
                  ) : (
                    folderSessions.map(sess => renderSessionItem(sess))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Unfiled Sessions Drop Zone & List */}
        <div 
          className="space-y-2 pt-2"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)}
        >
          {folders.length > 0 && (
            <div className="flex items-center gap-2 p-2">
              <span className="font-sans text-xs font-bold text-slate-400 uppercase tracking-wider">Sin Clasificar</span>
            </div>
          )}
          
          {sessions.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <span className="text-xs block font-medium">Historial vacío</span>
            </div>
          ) : (
            unfiledSessions.map(sess => renderSessionItem(sess))
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <button 
          onClick={() => setShowCalibration(true)}
          className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white rounded-xl text-sm font-medium transition-all shadow-md shadow-slate-900/20"
        >
          <Mic className="h-4 w-4 text-emerald-400" />
          <span>Calibrar mi Voz</span>
        </button>
      </div>

      {showCalibration && (
        <VoiceCalibrationModal 
          userId={userId} 
          onClose={() => setShowCalibration(false)} 
        />
      )}
    </div>
  );
}
