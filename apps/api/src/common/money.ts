/** All money is integer paise. Prices shown to buyers are rounded to whole rupees. */
export const PAISE_PER_RUPEE = 100;

export function roundToRupee(paise: number): number {
  return Math.round(paise / PAISE_PER_RUPEE) * PAISE_PER_RUPEE;
}

export function formatInr(paise: number): string {
  return `₹${(paise / PAISE_PER_RUPEE).toLocaleString('en-IN')}`;
}
