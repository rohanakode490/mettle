/**
 * Weight utility module for unit conversions, integer storage (*100), and formatting.
 */

export type WeightUnit = 'kg' | 'lb';

// Conversion factors
export const KG_TO_LB = 2.20462262;
export const LB_TO_KG = 0.45359237;

/**
 * Converts a weight value between kg and lb.
 */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to || isNaN(value) || !isFinite(value)) return value;
  if (from === 'kg' && to === 'lb') {
    return Math.round(value * KG_TO_LB * 100) / 100;
  }
  return Math.round(value * LB_TO_KG * 100) / 100;
}

/**
 * Converts a display weight to an integer stored value (multiplied by 100)
 * to avoid storing floating-point numbers in the database.
 * Example: 60 -> 6000, 60.5 -> 6050, 135.25 -> 13525
 */
export function weightToStored(weight: number): number {
  if (isNaN(weight) || !isFinite(weight)) return 0;
  return Math.round(weight * 100);
}

/**
 * Converts an integer stored weight (multiplied by 100) back to a display number (divided by 100).
 * Example: 6000 -> 60, 6050 -> 60.5, 13525 -> 135.25
 */
export function storedToWeight(stored: number): number {
  if (isNaN(stored) || !isFinite(stored)) return 0;
  return Math.round(stored) / 100;
}

/**
 * Formats an integer stored weight (multiplied by 100) into a string.
 * Uses exact string dot placement to avoid floating-point inaccuracies.
 * Example:
 * 6000 -> "60"
 * 6050 -> "60.5"
 * 6025 -> "60.25"
 * 50 -> "0.5"
 * 5 -> "0.05"
 * 0 -> "0"
 */
export function formatStoredWeight(stored: number): string {
  if (isNaN(stored) || !isFinite(stored)) return '0';
  const isNegative = stored < 0;
  const abs = Math.abs(Math.round(stored));
  const s = abs.toString().padStart(3, '0');
  const intPart = s.slice(0, -2);
  let decPart = s.slice(-2);

  if (decPart === '00') {
    return (isNegative ? '-' : '') + intPart;
  }
  if (decPart.endsWith('0')) {
    decPart = decPart.slice(0, 1);
  }
  return (isNegative ? '-' : '') + `${intPart}.${decPart}`;
}

/**
 * Formats a regular weight number (e.g. 60 or 60.5) into a clean display string.
 */
export function formatWeight(weight: number): string {
  if (isNaN(weight) || !isFinite(weight)) return '0';
  const stored = weightToStored(weight);
  return formatStoredWeight(stored);
}
