import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// The blocking script in __root.tsx already applies ".dark" before paint, so
// reading classList here on first client render matches reality — only the
// very first server-rendered markup (always "light") can briefly disagree,
// which is the standard, accepted tradeoff for a flash-free theme toggle.
const getIsDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(getIsDark);
  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing / storage disabled — theme just won't persist.
    }
    setIsDark(next);
  };
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      suppressHydrationWarning
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}
