"use client";

import { useState } from "react";
import type { CricketVariant } from "@/lib/types";

interface NewGameModalProps {
  onStartFreePlay: () => void;
  onStartCricket: (variant: CricketVariant) => void;
  onClose: () => void;
}

export function NewGameModal({ onStartFreePlay, onStartCricket, onClose }: NewGameModalProps) {
  const [step, setStep] = useState<"mode" | "cricket-variant">("mode");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-lg bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "mode" ? (
          <>
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">New Game</h2>
            <div className="flex flex-col gap-3">
              <ModalButton onClick={onStartFreePlay}>Free Play</ModalButton>
              <ModalButton onClick={() => setStep("cricket-variant")}>
                Cricket Practice
              </ModalButton>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">
              Cricket Practice — Target
            </h2>
            <div className="flex flex-col gap-3">
              <ModalButton onClick={() => onStartCricket("single")}>Single</ModalButton>
              <ModalButton onClick={() => onStartCricket("triple")}>Triple</ModalButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ModalButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500"
    >
      {children}
    </button>
  );
}
