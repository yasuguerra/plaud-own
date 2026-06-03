import React from "react";
import { Activity, BarChart2, PieChart, Users, TrendingUp, AlertCircle, ArrowRight, Award } from "lucide-react";
import { StudySession } from "../types";

interface InfographicsDashboardProps {
  session: StudySession;
}

export default function InfographicsDashboard({ session }: InfographicsDashboardProps) {
  // Parse transcript to calculate Speaker participation dynamically!
  const getSpeakerMetrics = () => {
    if (!session.transcript) {
      return [
        { name: "Hablante Principal", count: 1, percent: 100, color: "#6366f1" }
      ];
    }

    const lines = session.transcript.split("\n");
    const counts: { [key: string]: number } = {};
    let totalLines = 0;

    lines.forEach((line) => {
      // Matches [MM:SS] Speaker Name: ...
      const match = line.trim().match(/^\[\d{2}:\d{2}(?::\d{2})?\]\s*(.*?):\s*/);
      if (match) {
        const speaker = match[1].trim();
        counts[speaker] = (counts[speaker] || 0) + 1;
        totalLines++;
      }
    });

    if (totalLines === 0) {
      // Fallback for document or non-audio transcription
      return [
        { name: "Moderador / Lector", count: 3, percent: 60, color: "#6366f1" },
        { name: "Audiencia", count: 2, percent: 40, color: "#ec4899" }
      ];
    }

    const colors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"];
    return Object.entries(counts).map(([name, count], index) => {
      const percent = Math.round((count / totalLines) * 100);
      return {
        name,
        count,
        percent,
        color: colors[index % colors.length]
      };
    }).sort((a, b) => b.count - a.count);
  };

  const speakerMetrics = getSpeakerMetrics();

  // TODO: wire to real session sentiment data. Currently cosmetic/static curve points.
  // Sentiment analysis curve points
  const sentimentPoints = [
    { label: "Inicio", value: 50, desc: "Alineación inicial" },
    { label: "Análisis", value: 35, desc: "Identificación de bloqueos" },
    { label: "Lluvia de Ideas", value: 75, desc: "Propuestas y debates" },
    { label: "Acuerdos", value: 85, desc: "Toma de decisiones" },
    { label: "Cierre", value: 90, desc: "Asignación de accionables" }
  ];

  // Steps for Decision Pipeline based on actual action items
  const pipelineSteps = session.actionItems && session.actionItems.length > 0 
    ? session.actionItems.slice(0, 3) 
    : [
        { task: "Definición del Plan de Trabajo", importance: "high" },
        { task: "Fase de Pruebas Iniciales", importance: "medium" },
        { task: "Aprobación y Cierre de Proyecto", importance: "low" }
      ];

  return (
    <div className="space-y-6 p-1 font-sans">
      <div className="flex items-center justify-between border-b pb-3 mb-2 border-slate-100">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Infografía Corporativa</span>
          <h3 className="text-sm font-bold text-slate-800 mt-0.5">Analíticas Visuales de la Reunión</h3>
        </div>
        <BarChart2 className="h-5 w-5 text-indigo-500" />
      </div>

      {/* Grid: Participation and Tone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Card 1: Speaker Participation (Doughnut Chart SVG) */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3.5 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-indigo-500" />
            Participación por Hablante
          </h4>
          
          <div className="flex items-center justify-center gap-4 py-2 flex-1">
            {/* SVG Doughnut */}
            <div className="relative h-28 w-28 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3.2"
                />
                {(() => {
                  let accumulatedPercent = 0;
                  return speakerMetrics.map((sm, idx) => {
                    const strokeDasharray = `${sm.percent} ${100 - sm.percent}`;
                    const strokeDashoffset = 100 - accumulatedPercent;
                    accumulatedPercent += sm.percent;
                    return (
                      <circle
                        key={idx}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="none"
                        stroke={sm.color}
                        strokeWidth="3.4"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500 hover:stroke-[4]"
                      >
                        <title>{`${sm.name}: ${sm.percent}%`}</title>
                      </circle>
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-black text-slate-800 leading-none">
                  {speakerMetrics.length}
                </span>
                <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Voces</span>
              </div>
            </div>

            {/* Legends */}
            <div className="flex-1 space-y-1.5 max-h-[112px] overflow-y-auto pr-1">
              {speakerMetrics.map((sm, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: sm.color }} />
                    <span className="font-semibold text-slate-700 truncate" title={sm.name}>{sm.name}</span>
                  </div>
                  <span className="font-bold text-slate-500 font-mono ml-1">{sm.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Tone & Sentiment Timeline SVG */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3.5 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
            Flujo de Tono de la Discusión
          </h4>

          <div className="flex-1 flex flex-col justify-end pt-2">
            {/* SVG Line Graph */}
            <div className="h-24 w-full relative">
              <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                {/* Gridlines */}
                <line x1="0" y1="10" x2="100" y2="10" stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="20" x2="100" y2="20" stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="30" x2="100" y2="30" stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="2,2" />
                
                {/* Gradient Fill under Curve */}
                <defs>
                  <linearGradient id="sentimentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 5,30 C 25,35 25,15 45,25 C 65,30 65,5 85,8 L 85,40 L 5,40 Z"
                  fill="url(#sentimentGrad)"
                />

                {/* Line Path */}
                <path
                  d="M 5,30 C 25,35 25,15 45,25 C 65,30 65,5 85,8"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />

                {/* Points */}
                <circle cx="5" cy="30" r="1.5" fill="#4f46e5" />
                <circle cx="25" cy="32.5" r="1.5" fill="#4f46e5" />
                <circle cx="45" cy="22" r="1.5" fill="#4f46e5" />
                <circle cx="65" cy="27" r="1.5" fill="#4f46e5" />
                <circle cx="85" cy="8" r="1.5" fill="#4f46e5" />
              </svg>

              {/* Labels below SVG */}
              <div className="flex justify-between text-[8px] font-bold text-slate-400 mt-2 px-1">
                {sentimentPoints.map((pt, idx) => (
                  <div key={idx} className="text-center group relative cursor-pointer">
                    <span>{pt.label}</span>
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[7px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                      {pt.desc} ({pt.value}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Section: Strategic Action Roadmap Pipeline */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4">
        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-indigo-500" />
          Plan de Ruta y Prioridad de Decisiones
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {pipelineSteps.map((step, idx) => {
            const isHigh = 'importance' in step && step.importance === "high";
            const isMed = 'importance' in step && step.importance === "medium";
            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3.5 relative flex flex-col justify-between hover:border-indigo-200 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono">
                    Fase {idx + 1}
                  </span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                    isHigh 
                      ? "bg-red-50 text-red-700" 
                      : isMed 
                        ? "bg-amber-50 text-amber-700" 
                        : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {'importance' in step ? step.importance.toUpperCase() : "NORMAL"}
                  </span>
                </div>
                <p className="text-[10px] font-semibold text-slate-700 leading-relaxed min-h-[32px]">
                  {'task' in step ? step.task : String(step)}
                </p>
                <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 mt-2 border-t pt-2 border-slate-50">
                  <span>Implementación sugerida</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
