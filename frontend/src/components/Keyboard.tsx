'use client';

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

  const keyBase = "touch-key bg-[var(--card-bg)] hover:bg-[var(--foreground)] hover:text-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] font-bold rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className="w-full max-w-2xl mx-auto px-1 py-2 sm:p-2 bg-[var(--background)] border-t border-[var(--border-color)] select-none">
      <div className="flex flex-col gap-[6px]">
        {/* Row 1: Q-P + BACK */}
        <div className="flex justify-center gap-[4px] sm:gap-2">
          {rows[0].map(key => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onKeyPress(key.toLowerCase())}
              className={`${keyBase} flex-1 h-12 sm:h-14 text-base sm:text-lg min-w-0`}
            >
              {key.toLowerCase()}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={onBackspace}
            className={`${keyBase} flex-[1.3] h-12 sm:h-14 text-xs sm:text-sm min-w-0`}
            aria-label="Backspace"
          >
            back
          </button>
        </div>

        {/* Row 2: A-L + ENTER */}
        <div className="flex justify-center gap-[4px] sm:gap-2">
          {rows[1].map(key => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onKeyPress(key.toLowerCase())}
              className={`${keyBase} flex-1 h-12 sm:h-14 text-base sm:text-lg min-w-0`}
            >
              {key.toLowerCase()}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={onEnter}
            className={`${keyBase} flex-[1.5] h-12 sm:h-14 text-xs sm:text-sm min-w-0`}
          >
            enter
          </button>
        </div>

        {/* Row 3: Z-M only (no comma or period) */}
        <div className="flex justify-center gap-[4px] sm:gap-2 px-6 sm:px-10">
          {rows[2].map(key => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onKeyPress(key.toLowerCase())}
              className={`${keyBase} flex-1 h-12 sm:h-14 text-base sm:text-lg min-w-0`}
            >
              {key.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
