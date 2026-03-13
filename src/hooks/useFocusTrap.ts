import { RefObject, useEffect, useRef } from 'react';

export interface UseFocusTrapOptions {
  containerRef: RefObject<HTMLElement | null>;
  active: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  loop?: boolean;
}

/**
 * A robust, reusable focus trap hook.
 * - Cycles focus with Tab/Shift+Tab
 * - Prevents focus from leaving the container
 * - Restores focus on unmount/deactivate
 * - Supports nested traps via a stack (only the top trap is active)
 * - Optional Escape handling
 */
export function useFocusTrap({
  containerRef,
  active,
  initialFocusRef,
  onEscape,
  restoreFocusRef,
  loop = true,
}: UseFocusTrapOptions) {
  const capturedPrevFocusRef = useRef<HTMLElement | null>(null);
  const activatedRef = useRef(false);

  // Global stack per bundle: supports nested traps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trapStack = (useFocusTrap as any).__stack || ((useFocusTrap as any).__stack = [] as HTMLElement[]);

  useEffect(() => {
    const container = containerRef.current ?? null;

    // Deactivate: restore focus + clean stack
    if (!active || !container) {
      if (activatedRef.current) {
        activatedRef.current = false;

        if (trapStack[trapStack.length - 1] === container) {
          trapStack.pop();
        } else {
          const idx = trapStack.indexOf(container as unknown as HTMLElement);
          if (idx >= 0) trapStack.splice(idx, 1);
        }

        const toRestore =
          restoreFocusRef?.current ??
          capturedPrevFocusRef.current ??
          null;

        if (toRestore && typeof toRestore.focus === 'function') {
          setTimeout(() => toRestore.focus(), 0);
        }
        capturedPrevFocusRef.current = null;
      }
      return;
    }

    // === Activate ===
    activatedRef.current = true;
    trapStack.push(container);

    if (!restoreFocusRef?.current) {
      capturedPrevFocusRef.current = document.activeElement as HTMLElement | null;
    }

    const focusFirst = () => {
      const focusables = getFocusable(container);
      const preferred = initialFocusRef?.current ?? focusables[0] ?? container;

      if (preferred === container && !container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      (preferred as HTMLElement).focus?.();
    };
    setTimeout(focusFirst, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (trapStack[trapStack.length - 1] !== container) return;

      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation();
        e.preventDefault();
        onEscape();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = getFocusable(container);

        if (focusables.length === 0) {
          e.preventDefault();
          if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
          container.focus();
          return;
        }

        const current = document.activeElement as HTMLElement | null;
        const idx = current ? focusables.indexOf(current) : -1;

        if (idx === -1) {
          e.preventDefault();
          focusables[0]?.focus();
          return;
        }

        if (loop) {
          e.preventDefault();
          const nextIdx = e.shiftKey
            ? (idx - 1 + focusables.length) % focusables.length
            : (idx + 1) % focusables.length;
          const next = focusables[nextIdx];
          if (next && typeof next.focus === 'function') next.focus();
        } else {
          if (e.shiftKey && idx === 0) {
            e.preventDefault();
            focusables[0]?.focus();
          } else if (!e.shiftKey && idx === focusables.length - 1) {
            e.preventDefault();
            focusables[focusables.length - 1]?.focus();
          }
        }
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (trapStack[trapStack.length - 1] !== container) return;
      const target = e.target as Node | null;
      if (!target) return;

      if (!container.contains(target)) {
        const focusables = getFocusable(container);
        const fallback = focusables[0] ?? container;

        if (fallback === container && !container.hasAttribute('tabindex')) {
          container.setAttribute('tabindex', '-1');
        }
        (fallback as HTMLElement).focus?.();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);

      if (activatedRef.current) {
        if (trapStack[trapStack.length - 1] === container) {
          trapStack.pop();
        } else {
          const idx = trapStack.indexOf(container);
          if (idx >= 0) trapStack.splice(idx, 1);
        }
        activatedRef.current = false;
      }
    };
  }, [active, containerRef, initialFocusRef, onEscape, restoreFocusRef, loop]);
}

/** Utilities */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  const hasLayout = !!el.offsetParent || style.position === 'fixed';
  return hasLayout;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  const list = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return list
    .filter((el) => !el.hasAttribute('disabled'))
    .filter((el) => isVisible(el));
}
