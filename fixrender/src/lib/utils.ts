import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(prefix?: string) {
  return crypto.randomUUID();
}

export function generateReadableId(prefix: string, count: number) {
  const num = (count + 1).toString().padStart(4, '0');
  return `${prefix}-${num}`;
}

export function formatMoney(amount: number, symbol: string = '$') {
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
