"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CartLine } from "@/lib/types";
import { priceBasket, productSubtotal, slotSubtotal } from "@/lib/fees";

/**
 * The single cart.
 *
 * One basket per player, holding gear and court slots together — there is no
 * separate cart for daily games. Signed out it lives in localStorage so the
 * shop still works without an account; on sign-in the local basket is merged
 * into the account's and from then on the server copy is the truth, which is
 * what lets a cart started on a phone be paid for on a laptop.
 *
 * Prices held here are for DISPLAY ONLY. Checkout re-prices every line from
 * the products and sessions tables before charging, so a tampered cart cannot
 * change what is billed.
 */
const KEY = "superpro_cart_v1";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  /** Goods and court time combined, before fee, shipping or discount. */
  subtotalPaise: number;
  productSubtotalPaise: number;
  slotSubtotalPaise: number;
  convenienceFeePaise: number;
  hasProducts: boolean;
  hasSlots: boolean;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  addSlots: (slots: Array<Omit<CartLine, "qty">>) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  clearSlots: () => void;
  ready: boolean;
  syncing: boolean;
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

function writeLocal(lines: CartLine[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode — the cart just won't survive a reload */
  }
}

/** Merge two baskets by line id, keeping the larger quantity of each. */
function mergeLines(a: CartLine[], b: CartLine[]): CartLine[] {
  const out = new Map<string, CartLine>();
  for (const l of [...a, ...b]) {
    const existing = out.get(l.product_id);
    if (!existing) out.set(l.product_id, { ...l });
    else existing.qty = Math.max(existing.qty, l.qty);
  }
  return [...out.values()];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const signedIn = useRef(false);

  // On mount: show the local basket immediately, then reconcile with the
  // account's. Waiting for the network before rendering a cart the browser
  // already has would make every page load feel slower than it is.
  useEffect(() => {
    const local = read();
    setLines(local);
    setReady(true);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cart");
        const data = await res.json();
        if (cancelled || !data.signed_in) return;
        signedIn.current = true;
        const merged = mergeLines(data.lines ?? [], local);
        setLines(merged);
        writeLocal(merged);
        // Push the merge back only when the local basket contributed something.
        if (local.length > 0) {
          await fetch("/api/cart", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lines: merged }),
          }).catch(() => {});
        }
      } catch {
        /* offline or signed out — the local basket stands */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    writeLocal(next);
    if (!signedIn.current) return;
    setSyncing(true);
    fetch("/api/cart", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: next }),
    })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, []);

  const add = useCallback<CartContextValue["add"]>(
    (line, qty = 1) => {
      const next = [...read()];
      const found = next.find((l) => l.product_id === line.product_id);
      if (found) found.qty = Math.min(20, found.qty + qty);
      else next.push({ ...line, kind: line.kind ?? "product", qty });
      persist(next);
    },
    [persist],
  );

  /**
   * Court slots enter the same basket. Each is one seat, so a repeat add is a
   * no-op rather than a second ticket for the same session.
   */
  const addSlots = useCallback<CartContextValue["addSlots"]>(
    (slots) => {
      const next = [...read()];
      for (const slot of slots) {
        if (next.some((l) => l.product_id === slot.product_id)) continue;
        next.push({ ...slot, kind: "slot", qty: 1 });
      }
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

  const clear = useCallback(() => {
    persist([]);
    if (signedIn.current) fetch("/api/cart", { method: "DELETE" }).catch(() => {});
  }, [persist]);

  const clearSlots = useCallback(
    () => persist(read().filter((l) => (l.kind ?? "product") !== "slot")),
    [persist],
  );

  const value = useMemo<CartContextValue>(() => {
    const totals = priceBasket({ lines });
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotalPaise: totals.subtotalPaise,
      productSubtotalPaise: productSubtotal(lines),
      slotSubtotalPaise: slotSubtotal(lines),
      convenienceFeePaise: totals.convenienceFeePaise,
      hasProducts: lines.some((l) => (l.kind ?? "product") === "product"),
      hasSlots: lines.some((l) => l.kind === "slot"),
      add,
      addSlots,
      setQty,
      remove,
      clear,
      clearSlots,
      ready,
      syncing,
    };
  }, [lines, add, addSlots, setQty, remove, clear, clearSlots, ready, syncing]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
