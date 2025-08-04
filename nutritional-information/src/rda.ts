import { RDAValues } from './types';

export const RDA_VALUES: RDAValues = {
  'Vitamin A': { value: 900, unit: 'mcg' },
  'Vitamin C': { value: 90, unit: 'mg' },
  'Vitamin D': { value: 20, unit: 'mcg' },
  'Vitamin E': { value: 15, unit: 'mg' },
  'Vitamin K': { value: 120, unit: 'mcg' },
  'Thiamin (B1)': { value: 1.2, unit: 'mg' },
  'Riboflavin (B2)': { value: 1.3, unit: 'mg' },
  'Niacin (B3)': { value: 16, unit: 'mg' },
  'Vitamin B6': { value: 1.7, unit: 'mg' },
  'Folate': { value: 400, unit: 'mcg' },
  'Vitamin B12': { value: 2.4, unit: 'mcg' },
  'Biotin': { value: 30, unit: 'mcg' },
  'Pantothenic Acid': { value: 5, unit: 'mg' },
  'Calcium': { value: 1000, unit: 'mg' },
  'Iron': { value: 18, unit: 'mg' },
  'Magnesium': { value: 420, unit: 'mg' },
  'Phosphorus': { value: 700, unit: 'mg' },
  'Potassium': { value: 3400, unit: 'mg' },
  'Sodium': { value: 2300, unit: 'mg' },
  'Zinc': { value: 11, unit: 'mg' },
  'Copper': { value: 0.9, unit: 'mg' },
  'Manganese': { value: 2.3, unit: 'mg' },
  'Selenium': { value: 55, unit: 'mcg' },
  'Chromium': { value: 35, unit: 'mcg' },
  'Molybdenum': { value: 45, unit: 'mcg' },
  'Iodine': { value: 150, unit: 'mcg' }
};

export function calculateRDAPercentage(nutrientName: string, amount: number, unit: string): number | undefined {
  const rdaInfo = RDA_VALUES[nutrientName];
  if (!rdaInfo) return undefined;
  
  if (unit !== rdaInfo.unit) {
    const convertedAmount = convertToRDAUnit(amount, unit, rdaInfo.unit);
    if (convertedAmount === null) return undefined;
    amount = convertedAmount;
  }
  
  return Math.round((amount / rdaInfo.value) * 100);
}

function convertToRDAUnit(amount: number, fromUnit: string, toUnit: string): number | null {
  const conversions: { [key: string]: { [key: string]: number } } = {
    'g': { 'mg': 1000, 'mcg': 1000000 },
    'mg': { 'g': 0.001, 'mcg': 1000 },
    'mcg': { 'g': 0.000001, 'mg': 0.001 },
    'IU': { 'mcg': 0.025 }
  };
  
  if (fromUnit === toUnit) return amount;
  
  if (conversions[fromUnit]?.[toUnit]) {
    return amount * conversions[fromUnit][toUnit];
  }
  
  return null;
}