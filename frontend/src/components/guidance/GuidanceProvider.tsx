'use client';

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { Walkthrough, WalkthroughStep } from './Walkthrough';

interface GuidanceState {
  completedTours: string[];
  dismissedTours: string[];
  activeTour: string | null;
}

interface GuidanceContextValue {
  state: GuidanceState;
  startTour: (tourId: string) => void;
  completeTour: (tourId: string) => void;
  dismissTour: (tourId: string) => void;
  resetTour: (tourId: string) => void;
  isTourCompleted: (tourId: string) => boolean;
  isTourDismissed: (tourId: string) => boolean;
}

const GuidanceContext = createContext<GuidanceContextValue | null>(null);

const STORAGE_KEY = 'hunter-trades-guidance:v2';

function loadState(): GuidanceState {
  if (typeof window === 'undefined') {
    return { completedTours: [], dismissedTours: [], activeTour: null };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Invalid JSON — start fresh
  }

  return { completedTours: [], dismissedTours: [], activeTour: null };
}

function saveState(state: GuidanceState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — ignore
  }
}

// Lazy-load manifest to avoid bundling it into every chunk
interface Manifest {
  tours: Array<{
    id: string;
    title: string;
    description: string;
    steps: WalkthroughStep[];
  }>;
  settings: {
    animateSteps: boolean;
    allowSkip: boolean;
    showProgress: boolean;
    keyboardNavigation: boolean;
    storageKey: string;
  };
}

let manifestCache: Manifest | null = null;

async function loadManifest(): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  const mod = await import('@/config/guidance-manifest.json');
  manifestCache = mod.default as Manifest;
  return manifestCache;
}

export function GuidanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuidanceState>(loadState);
  const [tours, setTours] = useState<Manifest['tours']>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadManifest().then((manifest) => {
      setTours(manifest.tours);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const startTour = useCallback((tourId: string) => {
    setState((prev) => ({ ...prev, activeTour: tourId }));
  }, []);

  // Auto-start onboarding tour for first-time users
  useEffect(() => {
    if (isLoading || tours.length === 0) return;

    const onboardingTour = tours.find((t) => t.id === 'onboarding');
    if (!onboardingTour) return;

    const isAlreadyCompleted = state.completedTours.includes('onboarding');
    const isAlreadyDismissed = state.dismissedTours.includes('onboarding');

    if (!isAlreadyCompleted && !isAlreadyDismissed) {
      const timer = setTimeout(() => {
        startTour('onboarding');
      }, 1000); // 1s delay for better UX

      return () => clearTimeout(timer);
    }
  }, [isLoading, tours, state.completedTours, state.dismissedTours, startTour]);

  const completeTour = useCallback((tourId: string) => {
    setState((prev) => ({
      ...prev,
      activeTour: null,
      completedTours: prev.completedTours.includes(tourId)
        ? prev.completedTours
        : [...prev.completedTours, tourId],
    }));
  }, []);

  const dismissTour = useCallback((tourId: string) => {
    setState((prev) => ({
      ...prev,
      activeTour: null,
      dismissedTours: prev.dismissedTours.includes(tourId)
        ? prev.dismissedTours
        : [...prev.dismissedTours, tourId],
    }));
  }, []);

  const resetTour = useCallback((tourId: string) => {
    setState((prev) => ({
      ...prev,
      completedTours: prev.completedTours.filter((id) => id !== tourId),
      dismissedTours: prev.dismissedTours.filter((id) => id !== tourId),
    }));
  }, []);

  const isTourCompleted = useCallback(
    (tourId: string) => state.completedTours.includes(tourId),
    [state.completedTours]
  );

  const isTourDismissed = useCallback(
    (tourId: string) => state.dismissedTours.includes(tourId),
    [state.dismissedTours]
  );

  const activeTourData = state.activeTour ? tours.find((t) => t.id === state.activeTour) : null;

  return (
    <GuidanceContext.Provider
      value={{
        state,
        startTour,
        completeTour,
        dismissTour,
        resetTour,
        isTourCompleted,
        isTourDismissed,
      }}
    >
      {children}

      {activeTourData && (
        <Walkthrough
          steps={activeTourData.steps}
          isActive={!!activeTourData}
          onComplete={() => completeTour(activeTourData.id)}
          onSkip={() => dismissTour(activeTourData.id)}
          showProgress
        />
      )}

      {isLoading && null}
    </GuidanceContext.Provider>
  );
}

export function useGuidance() {
  const context = useContext(GuidanceContext);
  if (!context) {
    throw new Error('useGuidance must be used within a GuidanceProvider');
  }
  return context;
}

export function useActiveTour() {
  const { state } = useGuidance();
  return state.activeTour;
}

export function useCompletedTours() {
  const { state } = useGuidance();
  return state.completedTours;
}

export function useDismissedTours() {
  const { state } = useGuidance();
  return state.dismissedTours;
}
