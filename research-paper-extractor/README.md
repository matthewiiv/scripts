# Research Paper Contact Extractor

A TypeScript tool that uses OpenAI's o3-pro model via the Responses API to extract author contact information from research papers. It lists ALL authors but only retrieves contact information for European and UK authors.

## Features

- Parses CSV input files with paper information
- Uses OpenAI's structured outputs for consistent data extraction
- Parallel processing with configurable concurrency
- Progressive CSV output (appends results as they're processed)
- Dry-run mode for testing
- Clear progress indicators

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your OpenAI API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

## Usage

### Basic usage:
```bash
npm run extract -- --papers input-papers.csv
```

### With custom output files:
```bash
npm run extract -- --papers input-papers.csv --output all.csv --european-output europe.csv
```

### Dry run (no API calls):
```bash
npm run extract -- --papers input-papers.csv --dry-run
```

### With custom concurrency:
```bash
npm run extract -- --papers input-papers.csv --concurrency 5
```

### All options:
```bash
npm run extract -- --help
```

## Input Format

The input CSV should have the following columns:
- `Section`: Category/section of the paper
- `PaperName`: Name of the paper
- `Link`: URL to the paper

Example:
```csv
Section,PaperName,Link
AI Research,Attention Is All You Need,https://arxiv.org/abs/1706.03762
```

## Output Format

The script generates two CSV files:

1. **All Authors File** - Contains all authors from all papers with:
   - `Name`: Author's full name
   - `Nationality`: Author's nationality
   - `LinkedIn`: LinkedIn profile URL (or "Not found")
   - `Email`: Email address (or "Not found")
   - `Link to Paper`: Original paper URL
   - `Notes`: Additional notes about the author

2. **European Authors File** - Contains only European/UK authors with the same columns, but with actual contact information where available

## Command Line Options

- `--papers, -p`: Path to input CSV file (required)
- `--output, -o`: Path to output CSV file for all authors (default: all_authors.csv)
- `--european-output, -e`: Path to output CSV file for European/UK authors only (default: european_authors.csv)
- `--dry-run, -d`: Run without making API calls
- `--concurrency, -c`: Number of papers to process in parallel (default: 3)
- `--api-key, -k`: OpenAI API key (can also use OPENAI_API_KEY env variable)