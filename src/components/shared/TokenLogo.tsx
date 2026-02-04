"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { getTokenLogoUrl, getGenericTokenIcon } from "@/lib/utils/tokenLogo";

interface TokenLogoProps {
  tokenAddress: string;
  chainId?: number;
  tokenSymbol?: string;
  size?: number;
  alt?: string;
  className?: string;
}

const styles = stylex.create({
  container: {
    position: "relative",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    borderRadius: "50%",
    objectFit: "cover",
  },
  fallback: {
    borderRadius: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
    fontWeight: 500,
  },
});

export function TokenLogo({
  tokenAddress,
  chainId,
  tokenSymbol,
  size = 24,
  alt = "Token logo",
}: TokenLogoProps) {
  const [imgError, setImgError] = useState(false);

  const cleanSymbol =
    typeof tokenSymbol === "string" && tokenSymbol.length > 0
      ? (tokenSymbol.split("•")[0]?.trim() ?? tokenSymbol.trim()).toUpperCase()
      : null;

  const logoUrl = getTokenLogoUrl(tokenAddress, chainId, cleanSymbol ?? undefined);
  const displayUrl = imgError || !logoUrl ? getGenericTokenIcon() : logoUrl;

  return (
    <div {...stylex.props(styles.container)} style={{ width: size, height: size }}>
      {displayUrl.startsWith("data:image/svg+xml") ? (
        <div
          {...stylex.props(styles.fallback)}
          style={{ width: size, height: size }}
          dangerouslySetInnerHTML={{
            __html: decodeURIComponent(displayUrl.split(",")[1] ?? ""),
          }}
          aria-label={alt}
        />
      ) : (
        <img
          src={displayUrl}
          alt={alt}
          width={size}
          height={size}
          {...stylex.props(styles.image)}
          onError={() => setImgError(true)}
          style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
          loading="lazy"
        />
      )}
    </div>
  );
}
