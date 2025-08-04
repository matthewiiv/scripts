# Nutritional Information Calculator

A Node.js script that calculates nutritional information for ingredients using OpenAI's o3-pro model.

## Features

- Parses CSV files with ingredients and serving sizes
- Uses OpenAI's o3-pro model via the responses API endpoint
- Calculates vitamins and minerals as percentage of RDA
- Processes multiple ingredients in parallel
- Outputs results to both terminal and files (JSON and CSV)
- Dry-run mode by default for safety

## Installation

```bash
npm install
```

## Setup

1. Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your-api-key-here
```

Or pass the API key via command line.

## Usage

```bash
# Dry run (default) - shows what would be processed
npm run start sample-ingredients.csv

# Execute with API calls
npm run start sample-ingredients.csv --no-dry-run

# With custom options
npm run start ingredients.csv --no-dry-run --api-key YOUR_KEY --output results --concurrency 10
```

## CSV Format

The input CSV must have two columns:
- `Food`: The ingredient name
- `1 serving (g)`: The serving size in grams

Example:
```csv
Food,1 serving (g)
Spinach,30
Banana,120
Greek Yogurt,150
```

## Options

- `--api-key <key>`: OpenAI API key (alternative to env var)
- `--output <dir>`: Output directory (default: "output")
- `--concurrency <number>`: Number of parallel requests (default: 2)
- `--no-dry-run`: Execute API calls (default is dry run mode)

## Output

The script outputs:
1. Terminal display of all nutritional information
2. JSON file with complete results
3. CSV file with detailed breakdown

Results include:
- Calories per ingredient
- Major vitamins and minerals
- Percentage of Recommended Daily Allowance (RDA)
- Total daily summary against RDA