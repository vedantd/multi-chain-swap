"use client";

import * as stylex from '@stylexjs/stylex';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropdownBehavior } from "@/hooks/useDropdownBehavior";

import type { DropdownOption, TokenOption } from "@/types/swap";
import { TokenLogo } from "@/components/shared/TokenLogo";
import { getChainIcon, getChainLogoUrl } from "@/lib/utils/chainLogo";
import { sortTokensWithPopularFirst } from "@/lib/tokens/popularSort";
import { normalizeTokenAddress } from "@/lib/utils/address";
import { dropdown, form, layout } from "@/styles/shared.stylex";

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
  triggerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1,
    minWidth: 0,
  },
  triggerText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
    alignItems: 'center',
    alignContent: 'center',
    zIndex: 1100,
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    padding: '1.5rem',
    overflow: 'hidden',
  },
  sheet: {
    width: '100%',
    maxWidth: '28rem',
    maxHeight: 'min(calc(80vh - 3rem), calc(100vh - 3rem))',
    height: 'auto',
    background: '#020617',
    borderRadius: '1rem',
    border: '2px solid rgba(255,255,255,0.1)',
    padding: '0.75rem 1rem',
    paddingBottom: '1rem',
    boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
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
  networkSection: {
    flexShrink: 0,
    marginBottom: '0.75rem',
  },
  networkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  networkItem: {
    padding: '0.5rem 0',
    borderRadius: 0,
    border: 'none',
    cursor: 'pointer',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    fontWeight: 500,
    background: 'transparent',
    transition: 'color 0.15s ease, font-weight 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    textAlign: 'left',
    appearance: 'none',
    outline: 'none',
    boxShadow: 'none',
  },
  networkItemContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
    minWidth: 0,
  },
  networkItemLabel: {
    display: 'block',
  },
  chainIcon: {
    width: '1.25rem',
    height: '1.25rem',
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  chainIconTrigger: {
    width: '1.125rem',
    height: '1.125rem',
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  networkItemHighlighted: {
    color: 'var(--foreground)',
  },
  networkItemActive: {
    fontWeight: 600,
  },
  selectedCheck: {
    flexShrink: 0,
    color: 'var(--primary)',
    fontSize: '1rem',
    fontWeight: 700,
    marginLeft: 'auto',
  },
  tokenSection: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
    overflow: 'hidden',
  },
  searchContainer: {
    padding: '0.5rem 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'transparent',
    flexShrink: 0,
    marginBottom: '0.5rem',
  },
  searchInput: {
    width: '100%',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease',
  },
  tokenList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.25rem 0',
    listStyle: 'none',
    margin: 0,
    background: 'transparent',
    minHeight: 0,
  },
  tokenItem: {
    padding: '0.75rem',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    fontWeight: 500,
    background: 'transparent',
    marginBottom: '0.125rem',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  tokenItemContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
    minWidth: 0,
  },
  tokenItemText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  tokenItemHighlighted: {
    background: 'rgba(255, 255, 255, 0.05)',
  },
  tokenItemSelected: {
    background: 'rgba(59, 130, 246, 0.08)',
    fontWeight: 600,
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
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [triggerHovered, setTriggerHovered] = useState(false);
  const [hoveredPill, setHoveredPill] = useState<number | null>(null);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const { isOpen, open: openDropdown, close } = useDropdownBehavior({
    onClose: () => setSearch(""),
  });

  const activeChain = destinationChainOptions.find(
    (o) => Number(o.value) === destinationChainId
  );

  const selectedToken = destinationTokenOptions.find(
    (t) => normalizeTokenAddress(t.value) === normalizeTokenAddress(destinationToken)
  );

  const filteredChains = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return destinationChainOptions;
    return destinationChainOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q)
    );
  }, [destinationChainOptions, search]);

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


  useEffect(() => {
    if (isOpen) {
      setHighlightIndex(0);
      const t = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleSelectToken = (token: TokenOption) => {
    onChangeToken(token.value);
    close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => openDropdown()}
        {...stylex.props(
          styles.trigger,
          triggerHovered && styles.triggerHover
        )}
        onMouseEnter={() => setTriggerHovered(true)}
        onMouseLeave={() => setTriggerHovered(false)}
      >
        <div {...stylex.props(styles.triggerContent)}>
          {selectedToken && (
            <TokenLogo 
              tokenAddress={selectedToken.value} 
              chainId={destinationChainId}
              tokenSymbol={selectedToken.label}
              size={18}
              alt={selectedToken.label}
            />
          )}
          <span {...stylex.props(styles.triggerText)} title={activeChain && selectedToken ? `${activeChain.label} – ${selectedToken.label}` : undefined}>
            {activeChain ? (
              getChainLogoUrl(destinationChainId) ? (
                <img
                  src={getChainLogoUrl(destinationChainId)!}
                  alt={getChainIcon(destinationChainId)}
                  {...stylex.props(styles.chainIconTrigger)}
                />
              ) : (
                getChainIcon(destinationChainId)
              )
            ) : (
              "Select net"
            )}
            {selectedToken ? ` – ${selectedToken.label}` : ""}
          </span>
        </div>
        <span 
          {...stylex.props(
            styles.triggerArrow,
            isOpen && styles.triggerArrowOpen
          )} 
          aria-hidden 
        />
      </button>

      {isOpen && (
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
              {/* Network Selection */}
              <div {...stylex.props(styles.networkSection)}>
                <div {...stylex.props(styles.networkList)} role="list">
                  {filteredChains.map((opt) => {
                    const isActive = Number(opt.value) === destinationChainId;
                    return (
                      <div
                        key={opt.value}
                        role="button"
                        tabIndex={0}
                        onClick={() => onChangeChain(Number(opt.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onChangeChain(Number(opt.value));
                          }
                        }}
                        {...stylex.props(
                          styles.networkItem,
                          isActive && styles.networkItemActive,
                          hoveredPill === Number(opt.value) && !isActive && styles.networkItemHighlighted
                        )}
                        onMouseEnter={() => setHoveredPill(Number(opt.value))}
                        onMouseLeave={() => setHoveredPill(null)}
                      >
                        <div {...stylex.props(styles.networkItemContent)}>
                          {getChainLogoUrl(Number(opt.value)) ? (
                            <img
                              src={getChainLogoUrl(Number(opt.value))!}
                              alt={opt.label}
                              {...stylex.props(styles.chainIcon)}
                            />
                          ) : (
                            <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>
                              {getChainIcon(Number(opt.value))}
                            </span>
                          )}
                          <span {...stylex.props(styles.networkItemLabel)}>{opt.label}</span>
                          {isActive && (
                            <span {...stylex.props(styles.selectedCheck)} aria-hidden>✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Token Selection */}
              <div {...stylex.props(styles.tokenSection)}>
                <div {...stylex.props(styles.searchContainer)}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setHighlightIndex(0);
                    }}
                    placeholder="Search tokens"
                    {...stylex.props(styles.searchInput)}
                    aria-label="Search tokens"
                  />
                </div>
                <ul
                  ref={listRef}
                  role="listbox"
                  {...stylex.props(styles.tokenList)}
                >
                  {filteredTokens.length === 0 ? (
                    <li {...stylex.props(dropdown.emptyState)}>
                      No tokens match &quot;{search.trim() || "..."}&quot;
                    </li>
                  ) : (
                    filteredTokens.map((token, index) => {
                      const isSelected = normalizeTokenAddress(token.value) === normalizeTokenAddress(destinationToken);
                      const isHighlighted = index === highlightIndex;
                      return (
                        <li
                          key={token.value}
                          role="option"
                          aria-selected={isSelected}
                          {...stylex.props(
                            styles.tokenItem,
                            isSelected && styles.tokenItemSelected,
                            (isHighlighted || hoveredToken === token.value) && !isSelected && styles.tokenItemHighlighted
                          )}
                          onMouseEnter={() => {
                            setHoveredToken(token.value);
                            setHighlightIndex(index);
                          }}
                          onMouseLeave={() => setHoveredToken(null)}
                          onClick={() => handleSelectToken(token)}
                        >
                          <div {...stylex.props(styles.tokenItemContent)}>
                            <TokenLogo 
                              tokenAddress={token.value} 
                              chainId={destinationChainId}
                              tokenSymbol={token.label}
                              size={20}
                              alt={token.label}
                            />
                            <div {...stylex.props(styles.tokenItemText)}>
                              <span {...stylex.props(dropdown.itemLabel)}>{token.label}</span>
                              {token.sublabel && (
                                <span {...stylex.props(dropdown.itemSublabel)}>
                                  {token.sublabel}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <span {...stylex.props(styles.selectedCheck)} aria-hidden>✓</span>
                            )}
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
