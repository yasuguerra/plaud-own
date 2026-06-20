import React, { useState } from "react";
import { TopicFolder, StudySession } from "../types";
import { FolderHeart, Loader2, Sparkles, Map, BarChart3, Clock, Users } from "lucide-react";
import FormatMarkdown from "../App"; // We will pass this as a prop or move FormatMarkdown to a utils file. For now we will accept it as a prop.

interface FolderDashboardProps {
  folder: TopicFolder;
  sessions: StudySession[];
  isSynthesizing: boolean;
  onSynthesize: (folderId: string) => void;
  FormatMarkdown: React.ComponentType<{ text: string }>;
  onSelectSession: (sessionId: string) => void;
}

export default function FolderDashboard({ 
  folder, 
  sessions, 
  isSynthesizing, 
  onSynthesize,
  FormatMarkdown,
  onSelectSession
}: FolderDashboardProps) {

  // Calculate some basic metrics
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((acc, sess) => {
    // Basic heuristic: if it has a transcript, assume ~100 words per minute
    if (sess.transcript) return acc + Math.round(sess.transcript.split(" ").length / 100);
    return acc;
  }, 0);

  const totalActionItems = sessions.reduce((acc, sess) => acc + (sess.actionItems?.length || 0), 0);
  const completedActionItems = sessions.reduce((acc, sess) => acc + (sess.actionItems?.filter(a => a.completed).length || 0), 0);

  return (
    <div className="max-w-4xl w-full mx-auto flex flex-col gap-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 rounded-3xl p-8 md:p-10 shadow-lg text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 blur-2xl">
          <FolderHeart className="h-64 w-64" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
              <FolderHeart className="h-6 w-6 text-indigo-200" />
            </span>
            <span className="text-sm font-bold uppercase tracking-widest text-indigo-300">Base de Conocimiento</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">{folder.name}</h1>
          <p className="text-indigo-200/80 text-sm md:text-base max-w-2xl leading-relaxed">
            Este entorno agrupa {totalSessions} sesiones de reunión. Toda la información contenida aquí actuará como el contexto 
            principal para los análisis transversales, resúmenes globales y consultas de IA.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-3xs flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Users className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Sesiones</span>
          </div>
          <span className="text-2xl font-black text-slate-800">{totalSessions}</span>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-3xs flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Volumen Estimado</span>
          </div>
          <span className="text-2xl font-black text-slate-800">{totalDuration} <span className="text-sm text-slate-400 font-normal">min</span></span>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-3xs flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Accionables</span>
          </div>
          <span className="text-2xl font-black text-slate-800">{completedActionItems}/{totalActionItems}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: AI Synthesis */}
        <div className="md:col-span-2 bg-white border border-slate-200/60 rounded-2xl shadow-3xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              <h2 className="font-bold text-slate-800">Síntesis Ejecutiva Global</h2>
            </div>
            {(!folder.aiSynthesis || folder.aiSynthesis === "") && (
              <button
                disabled={isSynthesizing || totalSessions === 0}
                onClick={() => onSynthesize(folder.id)}
                className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSynthesizing ? <><Loader2 className="h-3 w-3 animate-spin" /> Procesando...</> : "Generar Resumen"}
              </button>
            )}
          </div>
          
          <div className="p-6 md:p-8 flex-1">
            {folder.aiSynthesis ? (
              <FormatMarkdown text={folder.aiSynthesis} />
            ) : (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
                {totalSessions === 0 ? (
                  <p className="text-sm">Agrega sesiones a esta carpeta arrastrándolas desde el menú lateral para generar una síntesis.</p>
                ) : (
                  <>
                    <Sparkles className="h-8 w-8 text-slate-200" />
                    <p className="text-sm max-w-sm">
                      Aún no has generado una síntesis ejecutiva para esta carpeta. La IA leerá todas las sesiones y creará un reporte unificado.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sessions List & Tools */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-3xs p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Herramientas Avanzadas</h3>
            <div className="space-y-2">
              <button 
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition flex items-center gap-3 group"
                onClick={() => alert("Generación de Mapa Mental transversal en construcción (Fase 4)")}
              >
                <div className="bg-slate-100 group-hover:bg-indigo-100 p-2 rounded-lg transition">
                  <Map className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-700 group-hover:text-indigo-700">Mapa Mental Global</span>
                  <span className="block text-[10px] text-slate-400">Extraer conceptos clave (Lazy)</span>
                </div>
              </button>
              
              <button 
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition flex items-center gap-3 group"
                onClick={() => alert("Generación de Infografías transversales en construcción (Fase 4)")}
              >
                <div className="bg-slate-100 group-hover:bg-emerald-100 p-2 rounded-lg transition">
                  <BarChart3 className="h-4 w-4 text-slate-500 group-hover:text-emerald-600" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-700 group-hover:text-emerald-700">Infografías de Carpeta</span>
                  <span className="block text-[10px] text-slate-400">Cruzar datos numéricos (Lazy)</span>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-3xs p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Minutas en Carpeta</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {sessions.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">Sin sesiones</p>
              ) : (
                sessions.map(sess => (
                  <div 
                    key={sess.id} 
                    onClick={() => onSelectSession(sess.id)}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-indigo-200 cursor-pointer transition flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-slate-700 truncate pr-2">{sess.title || sess.mediaName}</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap bg-white px-2 py-0.5 rounded-full border border-slate-100 shrink-0">
                      Abrir ↗
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
