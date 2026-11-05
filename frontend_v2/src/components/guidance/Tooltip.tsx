'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface TooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  isVisible: boolean;
  onClose?: () => void;
  className?: string;
}

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowClasses = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-accent-gold border-x-transparent border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-accent-gold border-x-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-accent-gold border-y-transparent border-r-transparent',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-accent-gold border-y-transparent border-l-transparent',
};

export function Tooltip({ content, position = 'top', isVisible, onClose, className = '' }: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      ref={tooltipRef}
      role="tooltip"
      className={`
        absolute z-[9999] px-3 py-2 text-sm text-text-primary
        bg-elevated border border-accent-gold/30 rounded-md shadow-lg
        max-w-xs whitespace-normal animate-in fade-in-0 zoom-in-95 duration-200
        ${positionClasses[position]}
        ${className}
      `}
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {content}
      <div
        className={`
          absolute w-0 h-0 border-4
          ${arrowClasses[position]}
        `}
        aria-hidden="true"
      />
    </div>
  );
}
