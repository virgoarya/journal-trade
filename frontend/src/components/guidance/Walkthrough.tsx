'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface WalkthroughStep {
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface WalkthroughProps {
  steps: WalkthroughStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  showProgress?: boolean;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Walkthrough({ steps, isActive, onComplete, onSkip, showProgress = true }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updateTargetRect = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    const target = document.querySelector(step.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTargetRect(null);
    }
  }, [currentStep, steps]);

  useEffect(() => {
    if (!isActive) {
      setCurrentStep(0);
      return;
    }

    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect);
    };
  }, [isActive, updateTargetRect]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStep, steps.length, onComplete, onSkip]);

  if (!isActive || !steps[currentStep]) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const tooltipPosition = step.position === 'top' ? 'bottom' : step.position === 'bottom' ? 'top' : step.position;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const padding = 12;
    switch (step.position) {
      case 'top':
        return { top: targetRect.top - padding, left: targetRect.left + targetRect.width / 2, transform: 'translate(-50%, -100%)' };
      case 'bottom':
        return { top: targetRect.top + targetRect.height + padding, left: targetRect.left + targetRect.width / 2, transform: 'translate(-50%, 0)' };
      case 'left':
        return { top: targetRect.top + targetRect.height / 2, left: targetRect.left - padding, transform: 'translate(-100%, -50%)' };
      case 'right':
        return { top: targetRect.top + targetRect.height / 2, left: targetRect.left + targetRect.width + padding, transform: 'translate(0, -50%)' };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  return (
    <>
      {/* Overlay — click outside auto-dismisses (per QA: must not trap user interaction) */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9998] bg-black/30 animate-in fade-in duration-300"
        aria-hidden="true"
        onClick={onSkip}
      />

      {/* Target highlight with stronger contrast */}
      {targetRect && (
        <>
          {/* Dark overlay everywhere except target */}
          <div
            className="fixed inset-0 z-[9998] pointer-events-none animate-in fade-in duration-200"
            style={{
              background: 'radial-gradient(circle at ' + 
                (targetRect.left + targetRect.width / 2) + 'px ' + 
                (targetRect.top + targetRect.height / 2) + 'px, ' +
                'transparent ' + Math.max(targetRect.width, targetRect.height) + 'px, ' +
                'rgba(0, 0, 0, 0.4) 100%)',
            }}
          />
          {/* Gold border around target */}
          <div
            className="fixed z-[9999] border-2 border-accent-gold rounded-lg pointer-events-none animate-in fade-in duration-200"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
              boxShadow: '0 0 0 4px rgba(212, 175, 55, 0.3), 0 0 20px rgba(212, 175, 55, 0.2)',
            }}
          />
        </>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="fixed z-[9999] bg-elevated border border-accent-gold/30 rounded-xl shadow-2xl p-4 max-w-sm animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ ...getTooltipStyle(), fontFamily: 'var(--font-sans)' }}
      >
        {showProgress && (
          <div className="flex items-center gap-1 mb-3">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i <= currentStep ? 'bg-accent-gold' : 'bg-border-subtle'
                }`}
              />
            ))}
          </div>
        )}

        <h3 className="text-base font-semibold text-text-primary mb-2">
          {step.title}
        </h3>

        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors duration-200"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-subtle rounded-md transition-colors duration-200"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-1.5 text-xs font-medium text-bg-void bg-accent-gold hover:bg-accent-gold-dim rounded-md transition-colors duration-200"
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        <div className="mt-3 text-[10px] text-text-muted text-right">
          {currentStep + 1} / {steps.length}
        </div>
      </div>
    </>
  );
}
