/**
 * Token amount formatting utilities.
 * Converts raw token amounts (smallest units) to human-readable strings.
 */

/**
 * Format raw token amount for display using explicit decimals.
 * 
 * @param raw - Raw token amount as string (e.g., "1500000" for 1.5 USDC with 6 decimals)
 * @param decimals - Number of decimals for the token (e.g., 6 for USDC, 9 for SOL, 18 for ETH)
 * @returns Formatted string with max 3 decimal places (e.g., "1.5", "0.026", "1000")
 * 
 * @example
 * formatRawAmountWithDecimals("1500000", 6) // "1.5"
 * formatRawAmountWithDecimals("26000", 6) // "0.026"
 * formatRawAmountWithDecimals("1000000000", 9) // "1"
 */
export function formatRawAmountWithDecimals(raw: string, decimals: number): string {
  try {
    const n = BigInt(raw);
    if (n === BigInt(0)) return "0";
    
    const div = BigInt(10 ** decimals);
    const intPart = n / div;
    const fracPart = n % div;
    
    // Convert fractional part to string with proper padding
    const fracStr = fracPart.toString().padStart(decimals, "0");
    
    // Cap at max 3 decimal places - round if necessary
    const maxDecimals = 3;
    let finalFracStr = fracStr;
    
    if (fracStr.length > maxDecimals) {
      // Round to 3 decimals using BigInt arithmetic to avoid precision loss
      // We need to round the fractional part, considering the 4th decimal place
      const roundingPosition = decimals - maxDecimals;
      const roundingFactor = BigInt(10 ** roundingPosition);
      const digitToCheck = (fracPart / roundingFactor) % BigInt(10);
      const roundedFrac = digitToCheck >= BigInt(5) 
        ? (fracPart / roundingFactor) + BigInt(1)
        : fracPart / roundingFactor;
      
      // Handle potential overflow when rounding up
      if (roundedFrac >= BigInt(10 ** maxDecimals)) {
        // Rounding caused overflow, increment integer part
        const newIntPart = intPart + BigInt(1);
        return String(newIntPart);
      }
      
      finalFracStr = roundedFrac.toString().padStart(maxDecimals, "0");
    }
    
    // Remove trailing zeros
    const trimmedFrac = finalFracStr.replace(/0+$/, "");
    
    // Return formatted string
    if (trimmedFrac.length === 0) {
      return String(intPart);
    }
    
    return `${intPart}.${trimmedFrac}`;
  } catch (error) {
    // If parsing fails, return original string
    console.warn("[formatRawAmountWithDecimals] Error formatting:", raw, error);
    return raw;
  }
}

/**
 * Decimals by symbol for common tokens.
 * Used to determine decimals when formatting amounts by currency symbol.
 */
const DECIMALS_BY_SYMBOL: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  WETH: 18,
  SOL: 9,
  BNB: 18,
  MATIC: 18,
  AVAX: 18,
};

/**
 * Format raw token amount for display using currency symbol.
 * 
 * @param raw - Raw token amount as string
 * @param currencySymbol - Token symbol (e.g., "USDC", "SOL", "ETH")
 * @returns Formatted string with max 3 decimal places
 * 
 * @example
 * formatRawAmount("26208", "USDC") // "0.026"
 * formatRawAmount("1500000000", "SOL") // "1.5"
 */
export function formatRawAmount(raw: string, currencySymbol: string): string {
  const decimals = DECIMALS_BY_SYMBOL[currencySymbol] ?? 6;
  return formatRawAmountWithDecimals(raw, decimals);
}
