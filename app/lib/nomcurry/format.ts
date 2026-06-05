export function formatToday() {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

export function formatHours(value: number) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

