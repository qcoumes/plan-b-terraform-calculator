import { QuantityRow } from "../engine/types";

export interface FilledRow {
  item: string;
  qty: number;
}

// Keeps rows with an item and a quantity > 0. Floors quantities unless allowFraction.
export function cleanRows(rows: readonly QuantityRow[], allowFraction = false): FilledRow[] {
  const filled: FilledRow[] = [];
  for (const row of rows) {
    const qty = Number(row.qty);
    if (!row.item || Number.isNaN(qty) || qty <= 0) continue;
    filled.push({ item: row.item, qty: allowFraction ? qty : Math.floor(qty) });
  }
  return filled;
}
