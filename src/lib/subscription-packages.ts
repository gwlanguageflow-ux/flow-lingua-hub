export const SUBSCRIPTION_PACKAGES = {
  mensal: { months: 1, discountRate: 0, label: "Mensal" },
  semestral: { months: 6, discountRate: 0.05, label: "Semestral" },
  anual: { months: 12, discountRate: 0.1, label: "Anual" },
} as const;

export type PackageType = keyof typeof SUBSCRIPTION_PACKAGES;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSubscriptionPackage(baseMonthlyPrice: number, packageType: PackageType) {
  if (!Number.isFinite(baseMonthlyPrice) || baseMonthlyPrice <= 0) {
    throw new Error("O valor mensal do plano deve ser maior que zero.");
  }

  const config = SUBSCRIPTION_PACKAGES[packageType];
  const baseAmount = roundMoney(baseMonthlyPrice * config.months);
  const discountAmount = roundMoney(baseAmount * config.discountRate);
  const totalAmount = roundMoney(baseAmount - discountAmount);

  return {
    packageType,
    months: config.months,
    discountRate: config.discountRate,
    label: config.label,
    baseAmount,
    discountAmount,
    totalAmount,
  };
}

export function addPackageMonths(startIso: string, packageType: PackageType) {
  const end = new Date(startIso);
  if (!Number.isFinite(end.getTime())) return null;
  end.setMonth(end.getMonth() + SUBSCRIPTION_PACKAGES[packageType].months);
  return end.toISOString();
}
