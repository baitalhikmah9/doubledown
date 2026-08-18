export function normalizeAffiliateEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAffiliateEmail(value: string): boolean {
  const email = normalizeAffiliateEmail(value);
  const at = email.indexOf('@');
  return at > 0 && at < email.length - 1 && !email.includes(' ');
}

export function computeCommissionMicros(
  priceAmountMicros: number,
  commissionPercent: number
): number {
  if (!Number.isInteger(priceAmountMicros) || priceAmountMicros < 0) return 0;
  if (!Number.isInteger(commissionPercent) || commissionPercent < 0) return 0;
  return Math.floor((priceAmountMicros * commissionPercent) / 100);
}

export type AffiliatePurchaseInput = {
  priceAmountMicros?: number;
  currencyCode?: string;
  commissionAmountMicros?: number;
};

export type AffiliateCurrencyStats = {
  currencyCode: string;
  purchaseCount: number;
  totalSaleMicros: number;
  totalCommissionMicros: number;
  averageSaleMicros: number;
  averageCommissionMicros: number;
};

export function aggregateAffiliateEarnings(
  purchases: AffiliatePurchaseInput[],
  commissionPercent: number
): AffiliateCurrencyStats[] {
  const groups = new Map<string, { count: number; sale: number; commission: number }>();

  for (const purchase of purchases) {
    const currency = purchase.currencyCode?.trim();
    const price = purchase.priceAmountMicros;
    if (!currency || price === undefined || !Number.isInteger(price) || price < 0) {
      continue;
    }

    const commission =
      purchase.commissionAmountMicros !== undefined
        ? purchase.commissionAmountMicros
        : computeCommissionMicros(price, commissionPercent);
    const existing = groups.get(currency) ?? { count: 0, sale: 0, commission: 0 };
    existing.count += 1;
    existing.sale += price;
    existing.commission += commission;
    groups.set(currency, existing);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currencyCode, group]) => ({
      currencyCode,
      purchaseCount: group.count,
      totalSaleMicros: group.sale,
      totalCommissionMicros: group.commission,
      averageSaleMicros: Math.floor(group.sale / group.count),
      averageCommissionMicros: Math.floor(group.commission / group.count),
    }));
}
