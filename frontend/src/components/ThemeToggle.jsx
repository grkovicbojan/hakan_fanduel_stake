import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, toggleTheme } from "../lib/theme.js";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      aria-label="Toggle day or night theme"
      aria-pressed={theme === "day"}
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === "day" ? "☀️ Day" : "🌙 Night"}
    </button>
  );
}
