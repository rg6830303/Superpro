/**
 * Basket maths, in one place.
 *
 * Kept free of server-only imports so the cart, the checkout and the order API
 * all price a basket identically — a fee the browser shows and the server
 * charges must come from the same function, or the two will drift.
 */
import type { CartLine } from "@/lib/types";

/**
 * Convenience fee on goods.
 *
 * Applies to products only. Court time is a service the club already prices
 * per head, and adding a payment-handling fee on top of a slot would quietly
 * change the advertised price of a game.
 */
export const CONVENIENCE_FEE_RATE = 0.025; // 2.5%

export function convenienceFeePaise(productSubtotalPaise: number): number {
  if (productSubtotalPaise <= 0) return 0;
  return Math.round(productSubtotalPaise * CONVENIENCE_FEE_RATE);
}

export type BasketTotals = {
  productSubtotalPaise: number;
  slotSubtotalPaise: number;
  subtotalPaise: number;
  convenienceFeePaise: number;
  shippingPaise: number;
  discountPaise: number;
  totalPaise: number;
  hasProducts: boolean;
  hasSlots: boolean;
};

export function isProductLine(l: CartLine): boolean {
  return (l.kind ?? "product") === "product";
}

export function isSlotLine(l: CartLine): boolean {
  return l.kind === "slot";
}

export function productSubtotal(lines: CartLine[]): number {
  return lines.filter(isProductLine).reduce((sum, l) => sum + l.price_paise * l.qty, 0);
}

export function slotSubtotal(lines: CartLine[]): number {
  return lines.filter(isSlotLine).reduce((sum, l) => sum + l.price_paise * l.qty, 0);
}

/**
 * Price a whole basket.
 *
 * Order of operations matters and is deliberate: the discount comes off the
 * goods and court time, and the convenience fee is charged on what the goods
 * actually cost after that discount — charging a fee on a price nobody paid
 * would be indefensible on an invoice. Shipping is never discounted and never
 * carries the fee.
 */
export function priceBasket(args: {
  lines: CartLine[];
  shippingPaise?: number;
  discountPaise?: number;
}): BasketTotals {
  const gross = productSubtotal(args.lines);
  const slots = slotSubtotal(args.lines);
  const shipping = Math.max(0, args.shippingPaise ?? 0);
  const discount = Math.min(Math.max(0, args.discountPaise ?? 0), gross + slots);

  // Split the discount across goods and court time in proportion, so the fee
  // is charged on the discounted goods rather than the sticker price.
  const base = gross + slots;
  const discountOnGoods = base > 0 ? Math.round(discount * (gross / base)) : 0;
  const netGoods = Math.max(0, gross - discountOnGoods);

  const fee = convenienceFeePaise(netGoods);

  return {
    productSubtotalPaise: gross,
    slotSubtotalPaise: slots,
    subtotalPaise: base,
    convenienceFeePaise: fee,
    shippingPaise: shipping,
    discountPaise: discount,
    totalPaise: Math.max(0, base - discount) + fee + shipping,
    hasProducts: gross > 0 || args.lines.some(isProductLine),
    hasSlots: args.lines.some(isSlotLine),
  };
}
