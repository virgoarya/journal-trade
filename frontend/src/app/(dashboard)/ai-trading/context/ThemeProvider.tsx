"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ThemeConfig, DEFAULT_THEME_CONFIG, LIGHT_THEME_CONFIG } from "../types";

interface ThemeProviderProps {
  children: React.ReactNode;
}

type ThemeContextType = {
  theme: ThemeConfig;
  setTheme: (mode: "light" | "dark") => void;
  toggleTheme: () => void;
  isSystemPreferenceDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG);
  const [isSystemPreferenceDark, setIsSystemPreferenceDark] = useState(false);

  // Initialize theme from localStorage and detect system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem("ai-trading-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setThemeState(storedTheme === "light" ? LIGHT_THEME_CONFIG : DEFAULT_THEME_CONFIG);
      return;
    }

    // Detect system preference
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsSystemPreferenceDark(mediaQuery.matches);
    setThemeState(mediaQuery.matches ? DEFAULT_THEME_CONFIG : LIGHT_THEME_CONFIG);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsSystemPreferenceDark(e.matches);
      setThemeState(e.matches ? DEFAULT_THEME_CONFIG : LIGHT_THEME_CONFIG);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setTheme = (mode: "light" | "dark") => {
    const newTheme = mode === "light" ? LIGHT_THEME_CONFIG : DEFAULT_THEME_CONFIG;
    setThemeState(newTheme);
    localStorage.setItem("ai-trading-theme", mode);
  };

  const toggleTheme = () => {
    const newMode = theme.mode === "dark" ? "light" : "dark";
    setTheme(newMode);
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
    isSystemPreferenceDark,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}