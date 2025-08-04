#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import { existsSync } from "fs";
import { parseCSV } from "./csv-parser";
import { OpenAIClient } from "./openai-client";
import { OutputFormatter } from "./output-formatter";
import { calculateRDAPercentage } from "./rda";
import { NutritionInfo, NutritionSummary } from "./types";

config();

const program = new Command();

program
  .name("nutrition-calc")
  .description("Calculate nutritional information for ingredients using OpenAI")
  .version("1.0.0")
  .argument("<csv-file>", "Path to CSV file with Food and serving columns")
  .option(
    "-k, --api-key <key>",
    "OpenAI API key (or use OPENAI_API_KEY env var)"
  )
  .option("-o, --output <dir>", "Output directory", "output")
  .option("-c, --concurrency <number>", "Number of parallel requests", "100")
  .option("--no-dry-run", "Execute the API calls (default is dry run)")
  .parse();

async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    console.log(
      `Processed ${Math.min(i + concurrency, items.length)} of ${
        items.length
      } ingredients...`
    );
  }

  return results;
}

function calculateSummary(results: NutritionInfo[]): NutritionSummary {
  const totalNutrients = new Map<
    string,
    { amount: number; unit: string; percentRDA: number }
  >();
  let totalCalories = 0;

  for (const result of results) {
    if (result.error) continue;

    if (result.calories) {
      totalCalories += result.calories;
    }

    for (const nutrient of result.nutrients) {
      const existing = totalNutrients.get(nutrient.name);

      if (existing && existing.unit === nutrient.unit) {
        existing.amount += nutrient.amount;
        const newPercentRDA = calculateRDAPercentage(
          nutrient.name,
          existing.amount,
          existing.unit
        );
        if (newPercentRDA !== undefined) {
          existing.percentRDA = newPercentRDA;
        }
      } else if (!existing) {
        totalNutrients.set(nutrient.name, {
          amount: nutrient.amount,
          unit: nutrient.unit,
          percentRDA: nutrient.percentRDA || 0,
        });
      }
    }
  }

  return { totalNutrients, totalCalories };
}

async function main() {
  const csvFile = program.args[0];
  const options = program.opts();

  if (!existsSync(csvFile)) {
    console.error(`Error: CSV file not found: ${csvFile}`);
    process.exit(1);
  }

  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: OpenAI API key not provided. Use --api-key or set OPENAI_API_KEY env var"
    );
    process.exit(1);
  }

  try {
    console.log("Parsing CSV file...");
    const ingredients = await parseCSV(csvFile);
    console.log(`Found ${ingredients.length} ingredients`);

    if (options.dryRun) {
      console.log("\n=== DRY RUN MODE ===");
      console.log("Would process the following ingredients:");
      ingredients.forEach((ing) =>
        console.log(`  - ${ing.name} (${ing.serving}g)`)
      );
      console.log("\nTo execute, run with --no-dry-run flag");
      return;
    }

    const client = new OpenAIClient(apiKey);
    const concurrency = parseInt(options.concurrency);

    console.log(
      `\nProcessing ingredients with concurrency of ${concurrency}...`
    );

    const results = await processInBatches(
      ingredients,
      (ing) => client.getNutritionInfo(ing.name, ing.serving),
      concurrency
    );

    const summary = calculateSummary(results);

    OutputFormatter.printResults(results, summary);
    OutputFormatter.saveResults(results, summary, options.output);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
