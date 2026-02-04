"use client";

import * as stylex from '@stylexjs/stylex';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DropdownOption, TokenOption } from "@/types/swap";
import { dropdown, form, layout } from "@/styles/shared.stylex";

// Popular/common tokens that should appear first
const POPULAR_TOKENS = new Set([
  "USDC", "USDT", "ETH", "WETH", "BTC", "WBTC", 
  "DAI", "MATIC", "BNB", "AVAX", "SOL", "OP", "ARB"
]);

function sortTokensWithPopularFirst(tokens: TokenOption[]): TokenOption[] {
  const popular: TokenOption[] = [];
  const others: TokenOption[] = [];
  
  tokens.forEach((token) => {
    if (POPULAR_TOKENS.has(token.label.toUpperCase())) {
      popular.push(token);
    } else {
      others.push(token);
    }
  });
  
  // Sort popular tokens by predefined order, then alphabetically
  popular.sort((a, b) => {
    const aUpper = a.label.toUpperCase();
    const bUpper = b.label.toUpperCase();
    const aIndex = Array.from(POPULAR_TOKENS).indexOf(aUpper);
    const bIndex = Array.from(POPULAR_TOKENS).indexOf(bUpper);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
  
  // Sort others alphabetically
  others.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  
  return [...popular, ...others];
}

interface DestinationSelectorProps {
  destinationChainId: number;
  destinationToken: string;
  destinationChainOptions: DropdownOption[];
  destinationTokenOptions: TokenOption[];
  onChangeChain: (chainId: number) => void;
  onChangeToken: (tokenAddress: string) => void;
}

const styles = stylex.create({
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.625rem 0.75rem',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--foreground)',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    fontWeight: 500,
    width: '100%',
    minWidth: '100%',
    transition: 'all 0.2s ease',
  },
  triggerHover: {
    background: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  triggerText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  triggerArrow: {
    flexShrink: 0,
    width: '0.5rem',
    height: '0.5rem',
    borderRight: '2px solid var(--muted-foreground)',
    borderBottom: '2px solid var(--muted-foreground)',
    transform: 'rotate(45deg)',
    marginBottom: '-0.15rem',
  },
  triggerArrowOpen: {
    transform: 'rotate(225deg)',
    marginBottom: '0.1rem',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: '#000000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
    zIndex: 1100,
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)',
    paddingLeft: '0.5rem',
    paddingRight: '0.5rem',
    overflow: 'hidden',
  },
  sheet: {
    width: '100%',
    maxWidth: '28rem',
    maxHeight: 'min(calc(70vh - 2rem), calc(100vh - 3rem))',
    height: 'auto',
    background: '#020617',
    borderTopLeftRadius: '1rem',
    borderTopRightRadius: '1rem',
    borderBottomLeftRadius: '1rem',
    borderBottomRightRadius: '1rem',
    borderBottom: '2px solid rgba(255,255,255,0.1)',
    padding: '0.75rem 1rem',
    paddingBottom: '1rem',
    boxShadow: '0 -12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    marginBottom: '1.5rem',
    boxSizing: 'border-box',
    position: 'relative',
  },
  sheetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
    flexShrink: 0,
  },
  sheetTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
  },
  sheetClose: {
    border: 'none',
    background: 'transparent',
    color: 'var(--muted-foreground)',
    cursor: 'pointer',
    fontSize: '1.5rem',
    lineHeight: 1,
    padding: 0,
    width: '1.5rem',
    height: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    overflow: 'hidden',
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
  },
  networkRow: {
    flexShrink: 0,
  },
  networkLabel: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    fontWeight: 500,
    marginBottom: '0.35rem',
    display: 'block',
  },
  networkPills: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  networkPill: {
    padding: '0.3rem 0.6rem',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--foreground)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  networkPillHover: {
    background: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  networkPillActive: {
    background: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    color: '#60a5fa',
  },
  tokenSection: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
    overflow: 'hidden',
  },
  tokenLabel: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    fontWeight: 500,
    marginBottom: '0.35rem',
    display: 'block',
  },
  searchInput: {
    marginBottom: '0.5rem',
    flexShrink: 0,
  },
  searchInputField: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
  },
  tokenList: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    minHeight: 0,
    maxHeight: '100%',
    WebkitOverflowScrolling: 'touch',
    paddingRight: '0.25rem',
    marginRight: '-0.25rem',
  },
  tokenRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    background: 'rgba(255, 255, 255, 0.03)',
    marginBottom: '0.25rem',
    transition: 'all 0.2s ease',
  },
  tokenRowHover: {
    background: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tokenRowSelected: {
    background: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  tokenSymbol: {
    fontWeight: 600,
  },
  tokenSublabel: {
    fontSize: '0.7rem',
    color: 'var(--muted-foreground)',
    marginTop: '0.05rem',
  },
});

export function DestinationSelector({
  destinationChainId,
  destinationToken,
  destinationChainOptions,
  destinationTokenOptions,
  onChangeChain,
  onChangeToken,
}: DestinationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [triggerHovered, setTriggerHovered] = useState(false);
  const [hoveredPill, setHoveredPill] = useState<number | null>(null);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const activeChain = destinationChainOptions.find(
    (o) => Number(o.value) === destinationChainId
  );

  const norm = (v: string) => (v.startsWith("0x") ? v.toLowerCase() : v);
  const selectedToken = destinationTokenOptions.find(
    (t) => norm(t.value) === norm(destinationToken)
  );

  const filteredTokens = useMemo(() => {
    const q = search.trim().toLowerCase();
    let tokens = destinationTokenOptions;
    
    // Filter by search query if present
    if (q) {
      tokens = tokens.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          (t.sublabel?.toLowerCase().includes(q) ?? false)
      );
    }
    
    // Sort with popular tokens first
    return sortTokensWithPopularFirst(tokens);
  }, [destinationTokenOptions, search]);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open]);


  const handleSelectToken = (token: TokenOption) => {
    onChangeToken(token.value);
    close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        {...stylex.props(
          styles.trigger,
          triggerHovered && styles.triggerHover
        )}
        onMouseEnter={() => setTriggerHovered(true)}
        onMouseLeave={() => setTriggerHovered(false)}
      >
        <span {...stylex.props(styles.triggerText)}>
          {activeChain ? activeChain.label : "Select network"}{" "}
          {selectedToken ? `• ${selectedToken.label}` : ""}
        </span>
        <span 
          {...stylex.props(
            styles.triggerArrow,
            open && styles.triggerArrowOpen
          )} 
          aria-hidden 
        />
      </button>

      {open && (
        <div 
          {...stylex.props(styles.backdrop)}
          onClick={close}
        >
          <div 
            ref={sheetRef} 
            {...stylex.props(styles.sheet)}
            onClick={(e) => e.stopPropagation()}
          >
            <div {...stylex.props(styles.sheetHeader)}>
              <h2 {...stylex.props(styles.sheetTitle)}>Select destination</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                {...stylex.props(styles.sheetClose)}
              >
                ×
              </button>
            </div>

            <div {...stylex.props(styles.sheetContent)}>
              <div {...stylex.props(styles.networkRow)}>
                <label {...stylex.props(styles.networkLabel)}>Network</label>
              <div {...stylex.props(styles.networkPills)}>
                {destinationChainOptions.map((opt) => {
                  const isActive = Number(opt.value) === destinationChainId;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChangeChain(Number(opt.value))}
                      {...stylex.props(
                        styles.networkPill,
                        isActive && styles.networkPillActive,
                        hoveredPill === Number(opt.value) && !isActive && styles.networkPillHover
                      )}
                      onMouseEnter={() => setHoveredPill(Number(opt.value))}
                      onMouseLeave={() => setHoveredPill(null)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              </div>

              <div {...stylex.props(styles.tokenSection)}>
                <label {...stylex.props(styles.tokenLabel)}>Token</label>
              <div {...stylex.props(styles.searchInput)}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tokens"
                  {...stylex.props(styles.searchInputField)}
                />
              </div>
                <div {...stylex.props(styles.tokenList)}>
                {filteredTokens.length === 0 ? (
                  <div {...stylex.props(dropdown.emptyState)}>
                    No tokens match “{search.trim() || "..."}”
                  </div>
                ) : (
                  filteredTokens.map((token) => {
                    const isSelected =
                      norm(token.value) === norm(destinationToken);
                    return (
                      <button
                        key={token.value}
                        type="button"
                        onClick={() => handleSelectToken(token)}
                        {...stylex.props(
                          styles.tokenRow,
                          isSelected && styles.tokenRowSelected,
                          hoveredToken === token.value && !isSelected && styles.tokenRowHover
                        )}
                        onMouseEnter={() => setHoveredToken(token.value)}
                        onMouseLeave={() => setHoveredToken(null)}
                      >
                        <div>
                          <div {...stylex.props(styles.tokenSymbol)}>
                            {token.label}
                          </div>
                          {token.sublabel && (
                            <div {...stylex.props(styles.tokenSublabel)}>
                              {token.sublabel}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

