'use client';
import { Delete } from "lucide-react";

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  disabled?: boolean;
}

export default function Keyboard({ onKeyPress, onBackspace, onEnter, disabled = false }: KeyboardProps) {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  return (
    <div className="w-full max-w-xl mx-auto p-2 bg-[var(--background)] border-t border-[var(--border-color)] select-none">
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-center gap-1 sm:gap-2">
            {i === 2 && (
              <button
                type="button"
                disabled={disabled}
                onClick={onEnter}
                className="touch-key px-2 sm:px-4 py-3 bg-[var(--card-bg)] hover:bg-[var(--foreground)] hover:text-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] font-bold text-xs sm:text-sm rounded flex-1 max-w-[70px] sm:max-w-[80px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
              >
                ENTER
              </button>
            )}
            
            {row.map(key => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onKeyPress(key.toLowerCase())}
                className="touch-key w-8 h-10 sm:w-10 sm:h-12 bg-[var(--card-bg)] hover:bg-[var(--foreground)] hover:text-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] font-bold rounded flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-base sm:text-lg"
              >
                {key}
              </button>
            ))}

            {i === 2 && (
              <button
                type="button"
                disabled={disabled}
                onClick={onBackspace}
                className="touch-key px-2 sm:px-4 py-3 bg-[var(--card-bg)] hover:bg-[var(--foreground)] hover:text-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] font-bold rounded flex-1 max-w-[70px] sm:max-w-[80px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Backspace"
              >
                <Delete size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
