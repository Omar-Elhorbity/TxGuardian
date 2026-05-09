"use client";

import { useMemo, type ReactNode } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";

/**
 * Wallet stack for the client. We rely on Wallet Standard auto-discovery
 * (Phantom, Solflare, Backpack, etc.) — no per-wallet adapter packages
 * needed.
 *
 * Connection endpoint defaults to public devnet. Override with
 * NEXT_PUBLIC_RPC_URL if you have a private RPC you want clients to hit
 * directly for signing/sending. (This is separate from server-side
 * RPC_URL used by the SDK; that one stays server-only.)
 */
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL ?? clusterApiUrl("devnet"),
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
