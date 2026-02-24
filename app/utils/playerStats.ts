"use client";

import { useState, useEffect } from "react";

const WALLET_STORAGE_KEY = "pz_crypto_wallet_balance";
const DEFAULT_BALANCE = 0.12;

export const PlayerStats = {
  DEFAULT_BALANCE,
  /**
   * Retrieves the current wallet balance.
   */
  getWalletBalance(): number {
    if (typeof window === "undefined") return DEFAULT_BALANCE;
    const stored = localStorage.getItem(WALLET_STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) return parsed;
    }
    return DEFAULT_BALANCE;
  },

  /**
   * Updates the wallet balance.
   */
  setWalletBalance(newBalance: number): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(WALLET_STORAGE_KEY, newBalance.toString());
    // Dispatch a custom event so our hook can update immediately in the same window
    window.dispatchEvent(new Event("wallet_balance_updated"));
  },

  /**
   * Adds an amount to the wallet balance.
   */
  addFunds(amount: number): number {
    const current = this.getWalletBalance();
    const updated = current + amount;
    this.setWalletBalance(updated);
    return updated;
  },

  /**
   * Substracts an amount from the wallet balance if sufficient funds exist.
   * Returns true if successful, false if insufficient.
   */
  spendFunds(amount: number): boolean {
    const current = this.getWalletBalance();
    if (current >= amount) {
      this.setWalletBalance(current - amount);
      return true;
    }
    return false;
  },

  /**
   * Resets the wallet balance to the given base value (or the default).
   * Call this when a new episode loads so story-driven funds start fresh.
   */
  resetWalletToBase(baseBalance: number = DEFAULT_BALANCE): void {
    this.setWalletBalance(baseBalance);
  }
};

/**
 * A React hook to reactively get the player's wallet balance.
 */
export function useWalletBalance() {
  const [balance, setBalance] = useState<number>(DEFAULT_BALANCE);

  useEffect(() => {
    // Initial load
    setBalance(PlayerStats.getWalletBalance());

    // Listener for same-window updates
    const handleUpdate = () => {
      setBalance(PlayerStats.getWalletBalance());
    };

    // Listener for cross-window updates
    const handleStorage = (e: StorageEvent) => {
      if (e.key === WALLET_STORAGE_KEY) {
        setBalance(PlayerStats.getWalletBalance());
      }
    };

    window.addEventListener("wallet_balance_updated", handleUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("wallet_balance_updated", handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return balance;
}
