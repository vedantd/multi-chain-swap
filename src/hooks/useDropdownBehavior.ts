"use client";

import { useCallback, useEffect, useState } from "react";

export interface UseDropdownBehaviorOptions {
  /** Called when the dropdown is closed (e.g. to clear search state). */
  onClose?: () => void;
}

export interface UseDropdownBehaviorReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Shared dropdown behavior: open/close state, Escape to close, body overflow lock when open.
 * Use in TokenSelect, DestinationSelector, etc. to avoid duplicating this logic.
 */
export function useDropdownBehavior(
  options: UseDropdownBehaviorOptions = {}
): UseDropdownBehaviorReturn {
  const { onClose } = options;
  const [isOpen, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const open = useCallback(() => setOpen(true), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  return { isOpen, open, close, toggle };
}
