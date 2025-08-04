#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { readPapersFromCSV } from './csv-handler';
import { SimplePaperProcessor } from './simple-processor';
import { CLIOptions } from './types';

dotenv.config();

const argv = yargs(hideBin(process.argv))
  .option('papers', {
    alias: 'p',
    type: 'string',
    description: 'Path to CSV file containing papers (columns: Section, PaperName, Link)',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Path to output CSV file for all authors',
    default: 'all_authors.csv'
  })
  .option('european-output', {
    alias: 'e',
    type: 'string',
    description: 'Path to output CSV file for European/UK authors only',
    default: 'european_authors.csv'
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Run in dry mode without making API calls',
    default: false
  })
  .option('concurrency', {
    alias: 'c',
    type: 'number',
    description: 'Number of papers to process in parallel',
    default: 3
  })
  .option('api-key', {
    alias: 'k',
    type: 'string',
    description: 'OpenAI API key (can also use OPENAI_API_KEY env variable)'
  })
  .option('use-responses-api', {
    alias: 'r',
    type: 'boolean',
    description: 'Use the new responses API for o1-pro/o3-pro models',
    default: false
  })
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: 'Limit the number of papers to process',
    default: 0
  })
  .help()
  .alias('help', 'h')
  .parseSync() as CLIOptions & { useResponsesApi: boolean; limit: number };

async function main() {
  try {
    const apiKey = argv.apiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey && !argv.dryRun) {
      console.error('Error: OpenAI API key is required. Set OPENAI_API_KEY environment variable or use --api-key option.');
      process.exit(1);
    }

    if (!fs.existsSync(argv.papers)) {
      console.error(`Error: Input file "${argv.papers}" not found.`);
      process.exit(1);
    }

    let papers = await readPapersFromCSV(argv.papers);

    if (papers.length === 0) {
      console.log('No papers found in the input file.');
      return;
    }

    // Apply limit if specified
    if (argv.limit > 0) {
      papers = papers.slice(0, argv.limit);
      console.log(`Limiting to first ${argv.limit} papers...`);
    }

    const processor = new SimplePaperProcessor(apiKey || '', argv.output, argv.europeanOutput, argv.dryRun);
    const results = await processor.processPapers(papers, argv.concurrency);
    
    if (!argv.dryRun && results.some(r => !r.error)) {
      console.log(`\\nAll authors saved to: ${path.resolve(argv.output)}`);
      console.log(`European authors saved to: ${path.resolve(argv.europeanOutput)}`);
    }

  } catch (error) {
    console.error('\\nFatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();