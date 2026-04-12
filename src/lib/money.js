export function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0";

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
