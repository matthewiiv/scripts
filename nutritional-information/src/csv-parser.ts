import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { Ingredient } from './types';

export async function parseCSV(filePath: string): Promise<Ingredient[]> {
  const ingredients: Ingredient[] = [];
  let rowCount = 0;
  let hasRequiredColumns = false;
  
  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      }))
      .on('data', (row) => {
        rowCount++;
        
        if (rowCount === 1) {
          if (!('Food' in row) || !('1 serving (g)' in row)) {
            reject(new Error('CSV must have "Food" and "1 serving (g)" columns'));
            return;
          }
          hasRequiredColumns = true;
        }
        
        const food = row['Food'];
        const servingStr = row['1 serving (g)'];
        
        if (food && servingStr) {
          const serving = parseFloat(servingStr);
          if (!isNaN(serving) && serving > 0) {
            ingredients.push({
              name: food.trim(),
              serving: serving
            });
          }
        }
      })
      .on('error', reject)
      .on('end', () => {
        if (rowCount === 0) {
          reject(new Error('CSV file is empty'));
        } else if (!hasRequiredColumns) {
          reject(new Error('CSV must have "Food" and "1 serving (g)" columns'));
        } else {
          resolve(ingredients);
        }
      });
  });
}