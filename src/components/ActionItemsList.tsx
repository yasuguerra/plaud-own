import React, { useState } from "react";
import { CheckSquare, Square, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { ActionItem } from "../types";

interface ActionItemsListProps {
  items: ActionItem[];
  onToggleItem: (id: string) => void;
  onAddItem: (task: string, importance: "high" | "medium" | "low") => void;
  onDeleteItem: (id: string) => void;
}

export default function ActionItemsList({ items, onToggleItem, onAddItem, onDeleteItem }: ActionItemsListProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const [importance, setImportance] = useState<"high" | "medium" | "low">("medium");

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    onAddItem(newTaskText.trim(), importance);
    setNewTaskText("");
  };

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
          <h2 className="font-sans text-lg font-bold text-slate-800">Key Action Items</h2>
          <p className="font-sans text-xs text-slate-500">Milestones and study checkpoints extracted from the content</p>
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
            <span className="text-xs font-bold text-slate-800 block">Completion Track</span>
            <span className="text-[10px] text-slate-500 font-mono">
              {completedCount} of {totalCount} goals met
            </span>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-[360px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
            <CheckCircle2 className="h-10 w-10 text-slate-200 mb-2" />
            <p className="text-sm font-medium">All clean! No active follow-ups.</p>
            <p className="text-xs">Add a custom task below to plan your study targets.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 ${
                item.completed
                  ? "bg-slate-50/50 border-slate-100 text-slate-400"
                  : "bg-white border-slate-100 text-slate-800 hover:border-slate-200 hover:shadow-xs"
              }`}
              id={`task-item-${item.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                <button
                  type="button"
                  onClick={() => onToggleItem(item.id)}
                  className="text-slate-400 hover:text-teal-500 transition duration-100 shrink-0"
                >
                  {item.completed ? (
                    <CheckSquare className="h-5 w-5 text-teal-500 fill-teal-50" />
                  ) : (
                    <Square className="h-5 w-5 rounded-md" />
                  )}
                </button>
                <span
                  className={`font-sans text-sm font-medium break-words leading-relaxed ${
                    item.completed ? "line-through text-slate-400 font-normal" : "text-slate-700"
                  }`}
                >
                  {item.task}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getPriorityClasses(item.importance)}`}>
                  {item.importance}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  className="p-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50/50 transition duration-150"
                  title="Remove Goal"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Form to Add Custom Tasks */}
      <div className="p-6 bg-slate-50/35 border-t border-slate-100 rounded-b-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Add your own follow-up study goal..."
              className="flex-1 bg-white font-sans text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100 transition duration-150 shadow-2xs text-slate-700"
              id="new-task-input"
            />
            <button
              type="submit"
              disabled={!newTaskText.trim()}
              className="bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 font-medium rounded-xl px-4 py-2.5 transition duration-150 flex items-center justify-center shrink-0 shadow-sm active:scale-95"
              title="Add Item"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-sans text-xs text-slate-400">Task Priority:</span>
            <div className="flex items-center gap-2">
              {(["high", "medium", "low"] as const).map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() => setImportance(level)}
                  className={`text-[11px] font-semibold capitalize px-2.5 py-1 rounded-lg border transition-all duration-100 ${
                    importance === level
                      ? level === "high"
                        ? "bg-rose-500 border-rose-500 text-white"
                        : level === "medium"
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "bg-slate-700 border-slate-700 text-white"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
