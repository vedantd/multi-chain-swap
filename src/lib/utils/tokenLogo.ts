/**
 * Token Logo Utilities
 * 
 * Provides logo URLs for tokens using CoinGecko's free image CDN.
 * Falls back to generic token icon if logo not found.
 */

import { CHAIN_ID_ETHEREUM, CHAIN_ID_BASE, CHAIN_ID_SOLANA, CHAIN_ID_OPTIMISM, CHAIN_ID_ARBITRUM, CHAIN_ID_POLYGON, CHAIN_ID_BNB, CHAIN_ID_AVALANCHE } from "@/lib/chainConfig";

/**
 * Mapping of token symbols to CoinGecko coin IDs for logo lookup.
 * This is more reliable than address-based lookup since addresses vary by chain.
 * Using CoinGecko's public image CDN: https://assets.coingecko.com/coins/images/{id}/small/{name}.png
 */
const SYMBOL_TO_COINGECKO: Record<string, { id: string; name: string }> = {
  "USDC": { id: "6319", name: "usd-coin" },
  "USDT": { id: "825", name: "tether" },
  "ETH": { id: "279", name: "ethereum" },
  "WETH": { id: "279", name: "ethereum" },
  "SOL": { id: "4128", name: "solana" },
  "MATIC": { id: "3890", name: "polygon" },
  "BNB": { id: "1839", name: "binancecoin" },
  "AVAX": { id: "5805", name: "avalanche-2" },
  "BTC": { id: "1", name: "bitcoin" },
  "WBTC": { id: "3717", name: "wrapped-bitcoin" },
  "DAI": { id: "4943", name: "dai" },
  "ARB": { id: "11841", name: "arbitrum" },
  "OP": { id: "11840", name: "optimism-ethereum" },
  "LINK": { id: "1975", name: "chainlink" },
  "UNI": { id: "12504", name: "uniswap" },
  "AAVE": { id: "7278", name: "aave" },
  "CRV": { id: "6538", name: "curve-dao-token" },
};

/**
 * Mapping of token addresses to CoinGecko coin IDs (for specific addresses).
 * CoinGecko image URL format: https://assets.coingecko.com/coins/images/{id}/small/{name}.png
 * Addresses are normalized: EVM addresses to lowercase, Solana addresses kept as-is
 */
const ADDRESS_TO_COINGECKO: Record<string, { id: string; name: string }> = {
  // Solana tokens (case-sensitive, keep original case)
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { id: "6319", name: "usd-coin" }, // USDC (Solana)
  "So11111111111111111111111111111111111111112": { id: "4128", name: "solana" }, // SOL
  
  // Ethereum tokens (normalized to lowercase)
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { id: "6319", name: "usd-coin" }, // USDC (Ethereum)
  "0x0000000000000000000000000000000000000000": { id: "279", name: "ethereum" }, // ETH
  
  // Base tokens
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { id: "6319", name: "usd-coin" }, // USDC (Base)
  "0x4200000000000000000000000000000000000006": { id: "279", name: "ethereum" }, // WETH (Base)
  
  // Optimism tokens
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": { id: "6319", name: "usd-coin" }, // USDC (Optimism)
  
  // Arbitrum tokens
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { id: "6319", name: "usd-coin" }, // USDC (Arbitrum)
  
  // Polygon tokens
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": { id: "6319", name: "usd-coin" }, // USDC (Polygon)
  "0x0000000000000000000000000000000000001010": { id: "3890", name: "polygon" }, // MATIC
  
  // BNB Chain tokens
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": { id: "6319", name: "usd-coin" }, // USDC (BNB)
  "0x0000000000000000000000000000000000000000": { id: "1839", name: "binancecoin" }, // BNB (BNB Chain)
  
  // Avalanche tokens
  "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": { id: "6319", name: "usd-coin" }, // USDC (Avalanche)
  "0x0000000000000000000000000000000000000000": { id: "5805", name: "avalanche-2" }, // AVAX (Avalanche)
};

/**
 * Get token logo URL from CoinGecko CDN.
 * First tries address-based lookup, then falls back to symbol-based lookup.
 * 
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (for context)
 * @param tokenSymbol - Optional token symbol for fallback lookup
 * @returns Logo URL or null
 */
export function getTokenLogoUrl(tokenAddress: string, chainId?: number, tokenSymbol?: string): string | null {
  // Normalize EVM addresses to lowercase for lookup
  // Solana addresses are case-sensitive, so keep them as-is
  const normalizedAddress = tokenAddress.startsWith("0x") 
    ? tokenAddress.toLowerCase() 
    : tokenAddress;
  
  // Try address-based lookup first (most reliable)
  let mapping = ADDRESS_TO_COINGECKO[normalizedAddress];
  
  // Fallback to symbol-based lookup if address not found
  // This handles tokens from APIs that might have different addresses
  if (!mapping && tokenSymbol) {
    const symbolUpper = tokenSymbol.toUpperCase().trim();
    mapping = SYMBOL_TO_COINGECKO[symbolUpper];
  }
  
  if (!mapping) {
    return null;
  }
  
  // CoinGecko image URL format
  // Using 'small' size (64x64) for better performance
  // Format: https://assets.coingecko.com/coins/images/{id}/small/{name}.png
  // Alternative: https://coin-images.coingecko.com/coins/images/{id}/small/{name}.png
  // Note: Some coins use capitalized filenames, component will retry if needed
  // For USDC specifically, verified URL: https://assets.coingecko.com/coins/images/6319/small/usd-coin.png
  const url = `https://assets.coingecko.com/coins/images/${mapping.id}/small/${mapping.name}.png`;
  
  return url;
}

/**
 * Get a generic token icon URL as fallback.
 * Uses a simple SVG data URL for a generic token icon.
 */
export function getGenericTokenIcon(): string {
  // Simple generic token icon as SVG data URL
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E";
}
