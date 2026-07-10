export const SUBSCRIPTION_PACKAGES = {
  mensal: { months: 1, discountRate: 0, label: "Mensal" },
  semestral: { months: 6, discountRate: 0.05, label: "Semestral" },
  anual: { months: 12, discountRate: 0.1, label: "Anual" },
} as const;

export type PackageType = keyof typeof SUBSCRIPTION_PACKAGES;
export type PackageBillingMode = "monthly" | "upfront";

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSubscriptionPackage(
  baseMonthlyPrice: number,
  packageType: PackageType,
  billingMode: PackageBillingMode = "monthly",
) {
  if (!Number.isFinite(baseMonthlyPrice) || baseMonthlyPrice <= 0) {
    throw new Error("O valor mensal do plano deve ser maior que zero.");
  }

  const config = SUBSCRIPTION_PACKAGES[packageType];
  const monthlyBaseAmount = roundMoney(baseMonthlyPrice);
  const monthlyDiscountAmount = roundMoney(monthlyBaseAmount * config.discountRate);
  const monthlyAmount = roundMoney(monthlyBaseAmount - monthlyDiscountAmount);
  const upfrontBaseAmount = roundMoney(baseMonthlyPrice * config.months);
  const upfrontDiscountAmount = roundMoney(upfrontBaseAmount * config.discountRate);
  const upfrontAmount = roundMoney(upfrontBaseAmount - upfrontDiscountAmount);
  const baseAmount = billingMode === "upfront" ? upfrontBaseAmount : monthlyBaseAmount;
  const discountAmount = billingMode === "upfront" ? upfrontDiscountAmount : monthlyDiscountAmount;
  const totalAmount = billingMode === "upfront" ? upfrontAmount : monthlyAmount;

  return {
    packageType,
    billingMode,
    months: config.months,
    paidMonths: billingMode === "upfront" ? config.months : 1,
    discountRate: config.discountRate,
    label: config.label,
    monthlyBaseAmount,
    monthlyDiscountAmount,
    monthlyAmount,
    upfrontBaseAmount,
    upfrontDiscountAmount,
    upfrontAmount,
    baseAmount,
    discountAmount,
    totalAmount,
  };
}

export function addPackageMonths(
  startIso: string,
  packageType: PackageType,
  billingMode: PackageBillingMode = "monthly",
) {
  const end = new Date(startIso);
  if (!Number.isFinite(end.getTime())) return null;
  end.setMonth(
    end.getMonth() + (billingMode === "upfront" ? SUBSCRIPTION_PACKAGES[packageType].months : 1),
  );
  return end.toISOString();
}
