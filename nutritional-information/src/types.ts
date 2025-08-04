export interface Ingredient {
  name: string;
  serving: number;
}

export interface Nutrient {
  name: string;
  amount: number;
  unit: string;
  percentRDA?: number;
}

export interface NutritionInfo {
  ingredient: string;
  serving: number;
  nutrients: Nutrient[];
  calories?: number;
  error?: string;
}

export interface RDAValues {
  [nutrient: string]: {
    value: number;
    unit: string;
  };
}

export interface NutritionSummary {
  totalNutrients: Map<string, {
    amount: number;
    unit: string;
    percentRDA: number;
  }>;
  totalCalories: number;
}

export interface OpenAINutritionResponse {
  calories: number;
  nutrients: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
}