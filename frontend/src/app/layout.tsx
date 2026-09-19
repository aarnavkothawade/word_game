'use client';
import { useEffect, useState } from "react";
import "./globals.css";
import { Moon, Sun } from "lucide-react";
import { SocketProvider } from "@/context/SocketContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme') as 'light' | 'dark';
    if (saved) {
      setTheme(saved);
      if (saved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', nextTheme);
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <SocketProvider>
          <header className="p-4 flex justify-between items-center border-b border-[var(--border-color)]">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-widest text-[var(--muted-foreground)]">
                WORD CHAIN
              </span>
              <span className="text-[11px] font-medium tracking-normal text-[var(--muted-foreground)] opacity-80">
                By AK
              </span>
            </div>
            <button 
              onClick={toggleTheme}
              className="p-2 border border-[var(--border-color)] rounded hover:bg-[var(--card-bg)] text-[var(--foreground)] transition-colors flex items-center gap-2 text-xs font-medium"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === 'dark' ? <Moon size={18} className="text-white" /> : <Sun size={18} className="text-amber-500" />
              ) : (
                <Moon size={18} />
              )}
              <span>{mounted ? (theme === 'dark' ? 'Dark' : 'Light') : ''}</span>
            </button>
          </header>
          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </SocketProvider>
      </body>
    </html>
  );
}
