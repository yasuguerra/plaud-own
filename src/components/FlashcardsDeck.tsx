import React, { useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle, BrainCircuit } from "lucide-react";
import { Flashcard } from "../types";

interface FlashcardsDeckProps {
  cards: Flashcard[];
  onToggleLearned: (id: string) => void;
}

export default function FlashcardsDeck({ cards, onToggleLearned }: FlashcardsDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
        <BrainCircuit className="h-10 w-10 text-slate-300 animate-pulse mb-3" />
        <h3 className="font-sans text-sm font-bold text-slate-700">No Flashcards Generated</h3>
        <p className="font-sans text-xs text-slate-400 mt-1">Please try uploading a different media source</p>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const learnedCount = cards.filter((c) => c.learned).length;

  const handleNext = () => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 150);
  };

  const handlePrev = () => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 150);
  };

  const currentProgress = Math.round((learnedCount / cards.length) * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-full" id="flashcard-deck-widget">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-6">
        <div>
          <h2 className="font-sans text-base font-bold text-slate-800">Flashcard Review Deck</h2>
          <p className="font-sans text-xs text-slate-400">Test your mental retention with active recall queries</p>
        </div>
        <div className="text-right">
          <span className="font-mono text-xs font-semibold text-slate-700 block">
            Card {currentIndex + 1} of {cards.length}
          </span>
          <span className="text-[10px] bg-slate-50 text-slate-500 font-bold px-2 py-0.5 rounded-full mt-0.5 inline-block">
            {learnedCount} Mastered ({currentProgress}%)
          </span>
        </div>
      </div>

      {/* 3D Flashing Card Container */}
      <div className="flex-1 flex flex-col justify-center items-center min-h-[300px] py-4">
        <div
          onClick={() => setFlipped(!flipped)}
          className="relative w-full max-w-md h-64 cursor-pointer [perspective:1000px] group select-none"
          id={`flashcard-wrapper-${currentCard.id}`}
        >
          <div
            className={`absolute inset-0 w-full h-full rounded-2xl border border-slate-200 shadow-md transition-all duration-700 [transform-style:preserve-3d] ${
              flipped ? "[transform:rotateY(180deg)]" : ""
            }`}
          >
            {/* Front Side */}
            <div className={`absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-white via-slate-50/10 to-indigo-50/5 p-8 flex flex-col justify-between [backface-visibility:hidden] ${
              currentCard.learned ? "border-emerald-200" : ""
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full">
                  Question Card
                </span>
                {currentCard.learned && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <CheckCircle className="h-3.5 w-3.5 fill-emerald-50" />
                    Mastered
                  </span>
                )}
              </div>
              <div className="flex-1 flex items-center justify-center py-4">
                <p className="font-sans text-base font-semibold text-slate-800 text-center leading-relaxed">
                  {currentCard.question}
                </p>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium">
                <RefreshCw className="h-3.5 w-3.5 animate-spin-slow text-slate-300" />
                Click anywhere to flip and see answer
              </div>
            </div>

            {/* Back Side (Rotated) */}
            <div className="absolute inset-0 w-full h-full rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-8 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest bg-rose-950/40 px-2 py-1 rounded-full border border-rose-900/30">
                  Concept Definition
                </span>
                {currentCard.learned && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-900/30">
                    <CheckCircle className="h-3.5 w-3.5 fill-emerald-950" />
                    Mastered
                  </span>
                )}
              </div>
              <div className="flex-1 flex items-center justify-center py-4 overflow-y-auto">
                <p className="font-sans text-sm text-slate-100 text-center leading-relaxed">
                  {currentCard.answer}
                </p>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium">
                <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                Click again to flip back
              </div>
            </div>
          </div>
        </div>

        {/* Action button bar */}
        <div className="mt-8 flex items-center justify-between w-full max-w-md gap-4">
          <button
            type="button"
            onClick={() => onToggleLearned(currentCard.id)}
            className={`flex-1 flex items-center justify-center gap-2 font-sans text-xs font-semibold px-4 py-3 rounded-xl border transition-all duration-150 ${
              currentCard.learned
                ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-50"
                : "bg-emerald-600 border-emerald-600 font-bold text-white hover:bg-emerald-700 shadow-sm shadow-emerald-100 text-sm active:scale-95"
            }`}
          >
            <CheckCircle className="h-4.5 w-4.5" />
            {currentCard.learned ? "Mark Unmastered" : "Check as Mastered"}
          </button>
        </div>
      </div>

      {/* Navigational buttons and index indicators */}
      <div className="border-t border-slate-50 pt-4 mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          className="flex items-center gap-1 font-sans text-xs font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl transition duration-150"
          title="Previous Flashcard"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        {/* Dots spacer */}
        <div className="flex gap-1">
          {cards.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-150 ${
                idx === currentIndex ? "w-4 bg-slate-800" : "w-1.5 bg-slate-250 bg-slate-200"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="flex items-center gap-1 font-sans text-xs font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl transition duration-150"
          title="Next Flashcard"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
