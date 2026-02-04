/**
 * Solana transaction helpers for swap execution.
 * Shared by Jupiter and Relay (base64 -> VersionedTransaction).
 */

import { VersionedTransaction } from "@solana/web3.js";

/**
 * Deserialize a base64-encoded serialized VersionedTransaction.
 */
export function deserializeBase64ToVersionedTransaction(base64: string): VersionedTransaction {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return VersionedTransaction.deserialize(buf);
}
