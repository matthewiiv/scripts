import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { NutritionInfo, NutritionSummary } from './types';
import { RDA_VALUES } from './rda';

export class OutputFormatter {
  static printResults(results: NutritionInfo[], summary: NutritionSummary): void {
    console.log('\n=== NUTRITIONAL INFORMATION ===\n');
    
    for (const result of results) {
      console.log(`\n${result.ingredient} (${result.serving}g):`);
      
      if (result.error) {
        console.log(`  Error: ${result.error}`);
        continue;
      }
      
      if (result.calories) {
        console.log(`  Calories: ${result.calories}`);
      }
      
      console.log('  Nutrients:');
      for (const nutrient of result.nutrients) {
        const rdaText = nutrient.percentRDA !== undefined ? ` (${nutrient.percentRDA}% RDA)` : '';
        console.log(`    ${nutrient.name}: ${nutrient.amount} ${nutrient.unit}${rdaText}`);
      }
    }
    
    console.log('\n=== DAILY TOTALS vs RDA ===\n');
    console.log(`Total Calories: ${summary.totalCalories}`);
    console.log('\nNutrient Summary:');
    
    const sortedNutrients = Array.from(summary.totalNutrients.entries())
      .sort((a, b) => b[1].percentRDA - a[1].percentRDA);
    
    for (const [name, data] of sortedNutrients) {
      const rdaInfo = RDA_VALUES[name];
      const rdaText = rdaInfo ? ` / ${rdaInfo.value} ${rdaInfo.unit}` : '';
      console.log(`  ${name}: ${data.amount.toFixed(2)} ${data.unit}${rdaText} (${data.percentRDA}% RDA)`);
    }
  }
  
  static saveResults(results: NutritionInfo[], summary: NutritionSummary, outputDir: string = 'output'): void {
    mkdirSync(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    
    const jsonOutput = {
      timestamp,
      results,
      summary: {
        totalCalories: summary.totalCalories,
        nutrients: Array.from(summary.totalNutrients.entries()).map(([name, data]) => ({
          name,
          ...data
        }))
      }
    };
    
    const jsonPath = join(outputDir, `nutrition-analysis-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
    
    const csvLines: string[] = ['Ingredient,Serving (g),Calories,Nutrient,Amount,Unit,% RDA'];
    
    for (const result of results) {
      if (result.error) {
        csvLines.push(`"${result.ingredient}",${result.serving},ERROR,"${result.error}",,,`);
        continue;
      }
      
      for (const nutrient of result.nutrients) {
        csvLines.push(
          `"${result.ingredient}",${result.serving},${result.calories || ''},"${nutrient.name}",${nutrient.amount},${nutrient.unit},${nutrient.percentRDA || ''}`
        );
      }
    }
    
    csvLines.push('');
    csvLines.push('SUMMARY,,,,,');
    csvLines.push(`Total Calories,${summary.totalCalories},,,,`);
    
    for (const [name, data] of summary.totalNutrients.entries()) {
      csvLines.push(`,,,"${name}",${data.amount.toFixed(2)},${data.unit},${data.percentRDA}`);
    }
    
    const csvPath = join(outputDir, `nutrition-analysis-${timestamp}.csv`);
    writeFileSync(csvPath, csvLines.join('\n'));
    
    console.log(`\nResults saved to:`);
    console.log(`  - ${jsonPath}`);
    console.log(`  - ${csvPath}`);
  }
}