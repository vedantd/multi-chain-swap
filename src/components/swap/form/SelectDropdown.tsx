"use client";

// External dependencies
import * as stylex from '@stylexjs/stylex';
import { useCallback, useEffect, useRef, useState } from "react";

// Internal types
import type { DropdownOption } from "@/types/swap";

// Styles
import { dropdown, form } from '@/styles/shared.stylex';

interface SelectDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  /** Optional test id for the trigger */
  "data-testid"?: string;
}

const styles = stylex.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  trigger: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.625rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--input-bg, #0f172a)',
    color: 'var(--foreground)',
    fontSize: '0.9375rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  triggerDisabled: {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  triggerText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  arrow: {
    flexShrink: 0,
    display: 'inline-block',
    width: '0.5rem',
    height: '0.5rem',
    borderRight: '2px solid var(--muted-foreground)',
    borderBottom: '2px solid var(--muted-foreground)',
    transform: 'rotate(45deg)',
    marginBottom: '-0.15rem',
  },
  arrowOpen: {
    transform: 'rotate(225deg)',
    marginBottom: '0.1rem',
  },
  menu: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: '0.25rem',
    padding: '0.25rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: '#0f172a',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    maxHeight: '12rem',
    overflowY: 'auto',
    zIndex: 1000,
    listStyle: 'none',
  },
  item: {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--foreground)',
    fontSize: '0.9375rem',
    fontWeight: 500,
    background: '#0f172a',
    border: '1px solid var(--border)',
    marginBottom: '0.25rem',
  },
  itemHighlighted: {
    background: '#1e293b',
  },
  itemSelected: {
    fontWeight: 600,
  },
});

export function SelectDropdown({
  options,
  value,
  onChange,
  placeholder = "Select…",
  label,
  disabled = false,
  "data-testid": testId,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % options.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + options.length) % options.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const opt = options[highlightIndex];
        if (opt) {
          onChange(opt.value);
          close();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close, options, highlightIndex, onChange]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlightIndex(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  return (
    <div ref={containerRef} {...stylex.props(styles.container)}>
      {label && (
        <label {...stylex.props(form.label)}>
          {label}
        </label>
      )}
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label ? `${label}: ${displayLabel}` : displayLabel}
        {...stylex.props(
          styles.trigger,
          disabled && styles.triggerDisabled
        )}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span {...stylex.props(styles.triggerText)}>
          {displayLabel}
        </span>
        <span
          {...stylex.props(styles.arrow, open && styles.arrowOpen)}
          aria-hidden
        />
      </button>
      {open && options.length > 0 && (
        <ul
          role="listbox"
          {...stylex.props(styles.menu)}
          style={{ background: '#0f172a' }}
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              {...stylex.props(
                styles.item,
                i === highlightIndex && styles.itemHighlighted,
                opt.value === value && styles.itemSelected
              )}
              style={{ 
                background: i === highlightIndex ? '#1e293b' : '#0f172a',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              onClick={() => {
                onChange(opt.value);
                close();
              }}
            >
              <span {...stylex.props(dropdown.itemLabel)}>{opt.label}</span>
              {opt.sublabel && (
                <span {...stylex.props(dropdown.itemSublabel)}>
                  {opt.sublabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
