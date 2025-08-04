import OpenAI from "openai";
import { calculateRDAPercentage } from "./rda";
import { Nutrient, NutritionInfo, OpenAINutritionResponse } from "./types";

export class OpenAIClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async getNutritionInfo(
    ingredient: string,
    serving: number
  ): Promise<NutritionInfo> {
    try {
      const instructions = `You are a nutritionist assistant that provides accurate nutritional data in JSON format.`;

      const input = `Analyze the nutritional content of ${serving}g of ${ingredient}. 
      Provide the major vitamins and minerals with their amounts and units.
      Format the response as a JSON object with the following structure:
      {
        "calories": number,
        "nutrients": [
          { "name": "Vitamin/Mineral name", "amount": number, "unit": "mg/mcg/g/IU" }
        ]
      }
      Include these nutrients if present: Vitamins A, C, D, E, K, B1, B2, B3, B6, B12, Folate, Biotin, Pantothenic Acid, Calcium, Iron, Magnesium, Phosphorus, Potassium, Sodium, Zinc, Copper, Manganese, Selenium, Chromium, Molybdenum, Iodine.`;

      const response = await this.client.responses.create({
        model: "gpt-4o",
        instructions: instructions,
        input:
          input +
          "\n\nIMPORTANT: Return your response as valid JSON only, with no additional text or markdown formatting.",
      });

      let fullContent = response.output_text;

      if (!fullContent) {
        throw new Error("No response content from OpenAI");
      }

      // Remove markdown code blocks if present
      fullContent = fullContent.trim();
      if (fullContent.startsWith("```json")) {
        fullContent = fullContent.slice(7);
      }
      if (fullContent.startsWith("```")) {
        fullContent = fullContent.slice(3);
      }
      if (fullContent.endsWith("```")) {
        fullContent = fullContent.slice(0, -3);
      }
      fullContent = fullContent.trim();

      const data: OpenAINutritionResponse = JSON.parse(fullContent);

      const nutrients: Nutrient[] = data.nutrients.map((n) => ({
        name: n.name,
        amount: n.amount,
        unit: n.unit,
        percentRDA: calculateRDAPercentage(n.name, n.amount, n.unit),
      }));

      return {
        ingredient,
        serving,
        nutrients,
        calories: data.calories,
      };
    } catch (error) {
      return {
        ingredient,
        serving,
        nutrients: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
