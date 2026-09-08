"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/lib/types";

/**
 * Cart lives in localStorage — no account required to shop. Prices held here
 * are for DISPLAY ONLY: /api/orders re-prices every line from the products
 * table before charging, so a tampered cart cannot change what is billed.
 */
const KEY = "superpro_cart_v1";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotalPaise: number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  ready: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function read(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(read());
    setReady(true);
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode / storage disabled — the cart just won't survive a reload */
    }
  }, []);

  const add = useCallback<CartContextValue["add"]>(
    (line, qty = 1) => {
      const next = [...read()];
      const found = next.find((l) => l.product_id === line.product_id);
      if (found) found.qty = Math.min(20, found.qty + qty);
      else next.push({ ...line, qty });
      persist(next);
    },
    [persist],
  );

  const setQty = useCallback<CartContextValue["setQty"]>(
    (productId, qty) => {
      const next = read()
        .map((l) => (l.product_id === productId ? { ...l, qty: Math.max(0, Math.min(20, qty)) } : l))
        .filter((l) => l.qty > 0);
      persist(next);
    },
    [persist],
  );

  const remove = useCallback<CartContextValue["remove"]>(
    (productId) => persist(read().filter((l) => l.product_id !== productId)),
    [persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotalPaise = lines.reduce((n, l) => n + l.price_paise * l.qty, 0);
    return { lines, count, subtotalPaise, add, setQty, remove, clear, ready };
  }, [lines, add, setQty, remove, clear, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
