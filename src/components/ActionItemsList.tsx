import React from "react";
import { CheckSquare, Square, Trash2, CheckCircle2 } from "lucide-react";
import { ActionItem } from "../types";

interface ActionItemsListProps {
  items: ActionItem[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  isSharedMode?: boolean;
}

export default function ActionItemsList({ items, onToggleItem, onDeleteItem, isSharedMode }: ActionItemsListProps) {

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getPriorityClasses = (prio: "high" | "medium" | "low") => {
    switch (prio) {
      case "high":
        return "bg-rose-50 text-rose-700 border border-rose-100";
      case "medium":
        return "bg-amber-50 text-amber-700 border border-amber-100";
      case "low":
        return "bg-slate-50 text-slate-700 border border-slate-100";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 shadow-sm" id="action-items-container">
      {/* Header with Stats */}
      <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-50/20 to-indigo-50/20 rounded-t-2xl">
        <div>
          <h2 className="font-sans text-base font-bold text-slate-800">Objetivos y Accionables</h2>
          <p className="font-sans text-xs text-slate-500">Tareas y compromisos clave extraídos de la reunión</p>
        </div>
        
        {/* Progress gauge */}
        <div className="flex items-center gap-3 bg-white px-4 py-2 border border-slate-100 rounded-xl shadow-xs shrink-0">
          <div className="relative h-10 w-10 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-slate-100"
                strokeWidth="3.5"
                fill="transparent"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-teal-500 transition-all duration-500 ease-out"
                strokeWidth="3.5"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - progressPercent / 100)}
                fill="transparent"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-mono text-[10px] font-bold text-slate-700">{progressPercent}%</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">Seguimiento de Progreso</span>
            <span className="text-[10px] text-slate-550 font-semibold font-mono text-slate-500">
              {completedCount} de {totalCount} metas cumplidas
            </span>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-[360px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
            <CheckCircle2 className="h-10 w-10 text-slate-200 mb-2 animate-pulse" />
            <p className="text-sm font-bold text-slate-700">¡Todo al día!</p>
            <p className="text-xs text-slate-400 mt-1">No hay tareas pendientes en esta reunión. Puedes añadir un objetivo abajo.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 ${
                item.completed
                  ? "bg-slate-50/60 border-slate-100 text-slate-400"
                  : "bg-white border-slate-100 text-slate-800 hover:border-slate-200 hover:shadow-xs"
              }`}
              id={`task-item-${item.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!isSharedMode) onToggleItem(item.id);
                  }}
                  className={`transition duration-100 shrink-0 ${!isSharedMode ? 'text-slate-400 hover:text-teal-500 cursor-pointer' : 'text-slate-400 cursor-default'}`}
                >
                  {item.completed ? (
                    <CheckSquare className="h-5 w-5 text-teal-500 fill-teal-50" />
                  ) : (
                    <Square className="h-5 w-5 rounded-md" />
                  )}
                </button>
                <span
                  className={`font-sans text-xs font-semibold break-words leading-relaxed ${
                    item.completed ? "line-through text-slate-400 font-normal" : "text-slate-700"
                  }`}
                >
                  {item.task}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getPriorityClasses(item.importance)}`}>
                  {item.importance === "high" ? "Alta" : item.importance === "medium" ? "Media" : "Baja"}
                </span>
                {!isSharedMode && (
                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  className="p-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50/50 transition duration-150 cursor-pointer"
                  title="Eliminar objetivo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
