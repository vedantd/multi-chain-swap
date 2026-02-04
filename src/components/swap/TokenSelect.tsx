"use client";

// External dependencies
import * as stylex from '@stylexjs/stylex';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Internal types
import type { TokenOption } from "@/types/swap";

// Styles
import { dropdown, form } from '@/styles/shared.stylex';

const COMMON_SYMBOLS = new Set(["SOL", "USDC", "USDT", "ETH", "WETH", "BNB", "MATIC", "AVAX"]);

function sortOptions(opts: TokenOption[]): TokenOption[] {
  return [...opts].sort((a, b) => {
    const aCommon = COMMON_SYMBOLS.has(a.label.toUpperCase());
    const bCommon = COMMON_SYMBOLS.has(b.label.toUpperCase());
    if (aCommon && !bCommon) return -1;
    if (!aCommon && bCommon) return 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}

function filterOptions(opts: TokenOption[], search: string): TokenOption[] {
  const q = search.trim().toLowerCase();
  if (!q) return sortOptions(opts);
  return opts.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      (o.sublabel?.toLowerCase().includes(q) ?? false)
  );
}

interface TokenSelectProps {
  options: TokenOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
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
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: '#0f172a',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    zIndex: 1000,
    overflow: 'hidden',
  },
  searchContainer: {
    padding: '0.5rem',
    borderBottom: '1px solid var(--border)',
    background: '#0f172a',
  },
  searchInput: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: '#0f172a',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
  },
  list: {
    maxHeight: '14rem',
    overflowY: 'auto',
    padding: '0.25rem',
    listStyle: 'none',
    margin: 0,
    background: '#0f172a',
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

export function TokenSelect({
  options,
  value,
  onChange,
  placeholder = "Select token",
  label,
  disabled = false,
  "data-testid": testId,
}: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const norm = (v: string) => (v.startsWith("0x") ? v.toLowerCase() : v);
  const selected = options.find((o) => norm(o.value) === norm(value));
  const displayLabel = selected?.label ?? placeholder;

  const filtered = useMemo(() => filterOptions(options, search), [options, search]);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
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
    if (open) {
      setSearch("");
      setHighlightIndex(0);
      const t = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % Math.max(1, filtered.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const opt = filtered[highlightIndex];
        if (opt) {
          onChange(opt.value);
          close();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close, filtered, highlightIndex, onChange]);

  useEffect(() => {
    if (open && filtered.length) {
      const idx = filtered.findIndex((o) => o.value === value);
      setHighlightIndex(idx >= 0 ? idx : 0);
    }
  }, [open, value, filtered]);

  useEffect(() => {
    if (!open || !listRef.current || filtered.length === 0) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, highlightIndex, filtered.length]);

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
      {open && (
        <div {...stylex.props(styles.menu)} style={{ background: '#0f172a' }}>
          <div {...stylex.props(styles.searchContainer)} style={{ background: '#0f172a' }}>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
                  e.preventDefault();
                }
              }}
              placeholder="Search by symbol or name"
              {...stylex.props(styles.searchInput)}
              style={{ background: '#0f172a' }}
              aria-label="Search tokens"
            />
          </div>
          <ul
            ref={listRef}
            role="listbox"
            {...stylex.props(styles.list)}
            style={{ background: '#0f172a' }}
          >
            {filtered.length === 0 ? (
              <li {...stylex.props(dropdown.emptyState)} style={{ background: '#0f172a' }}>
                No tokens match &quot;{search.trim() || "..."}&quot;
              </li>
            ) : (
              filtered.map((opt, i) => (
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
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
