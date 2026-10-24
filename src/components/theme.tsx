"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
export type Theme = "light" | "dark" | "system";
const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "system", setTheme: () => {} });
export function ThemeProvider({
  initial,
  children,
}: {
  initial: Theme;
  children: React.ReactNode;
}) {
  const [theme, setValue] = useState<Theme>(initial);
  function setTheme(value: Theme) {
    setValue(value);
    document.documentElement.dataset.theme = value;
    document.cookie = `defend_theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function ThemeSwitch() {
  const { theme, setTheme } = useContext(ThemeContext);
  const Current = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <details className="theme-menu">
      <summary aria-label={`Appearance: ${theme}`} title="Change appearance">
        <Current size={16} />
        <span>
          {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
        </span>
      </summary>
      <div className="theme-options" role="group" aria-label="Appearance">
        {(
          [
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
            { id: "system", label: "Use device setting", icon: Monitor },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={theme === t.id}
            onClick={(e) => {
              setTheme(t.id);
              e.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            <t.icon size={16} />
            {t.label}
            {theme === t.id && <Check size={14} />}
          </button>
        ))}
      </div>
    </details>
  );
}
