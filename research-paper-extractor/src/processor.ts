import pLimit from 'p-limit';
import ora from 'ora';
import { PaperInput, ProcessingResult, AuthorContact } from './types';
import { OpenAIResponsesClient } from './openai-client-responses';
import { appendToCSV, isEuropeanOrUK } from './csv-handler';

export class PaperProcessor {
  private openAIClient: OpenAIResponsesClient;
  private dryRun: boolean;
  private outputPath: string;
  private europeanOutputPath: string;

  constructor(apiKey: string, outputPath: string, europeanOutputPath: string, dryRun: boolean = false) {
    this.openAIClient = new OpenAIResponsesClient(apiKey);
    this.dryRun = dryRun;
    this.outputPath = outputPath;
    this.europeanOutputPath = europeanOutputPath;
  }

  async processPapers(papers: PaperInput[], concurrency: number = 3): Promise<ProcessingResult[]> {
    const limit = pLimit(concurrency);
    const results: ProcessingResult[] = [];
    
    const spinner = ora({
      text: 'Processing papers...',
      spinner: 'dots'
    });

    if (!this.dryRun) {
      spinner.start();
    }

    const totalPapers = papers.length;
    let processedCount = 0;

    const processingTasks = papers.map((paper, index) => 
      limit(async () => {
        try {
          if (this.dryRun) {
            console.log(`[DRY RUN] Would process paper: "${paper.PaperName}" (${paper.Link})`);
            
            const mockAuthors: AuthorContact[] = [
              {
                name: 'Dr. Example Author',
                nationality: 'United Kingdom',
                linkedin: 'https://linkedin.com/in/example',
                email: 'example@university.edu',
                paper_link: paper.Link,
                notes: 'Mock data for dry run'
              }
            ];
            
            results.push({
              paperName: paper.PaperName,
              authors: mockAuthors
            });
          } else {
            spinner.text = `Processing (${processedCount + 1}/${totalPapers}): ${paper.PaperName}`;
            
            const startTime = Date.now();
            const authors = await this.openAIClient.extractAuthorContacts(paper.Link, paper.PaperName);
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            console.log(`\n✓ Completed ${paper.PaperName} in ${duration}s`);
            
            if (authors.length > 0) {
              // Write all authors to the main output file
              await appendToCSV(this.outputPath, authors);
              
              // Filter and write European/UK authors to the European output file
              const europeanAuthors = authors.filter(author => isEuropeanOrUK(author.nationality));
              if (europeanAuthors.length > 0) {
                await appendToCSV(this.europeanOutputPath, europeanAuthors);
              }
            }
            
            results.push({
              paperName: paper.PaperName,
              authors
            });
          }
          
          processedCount++;
          
          if (!this.dryRun) {
            spinner.text = `Processed ${processedCount}/${totalPapers} papers`;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`\\nError processing "${paper.PaperName}": ${errorMessage}`);
          
          results.push({
            paperName: paper.PaperName,
            authors: [],
            error: errorMessage
          });
          
          processedCount++;
        }
      })
    );

    await Promise.all(processingTasks);

    if (!this.dryRun) {
      spinner.succeed(`Successfully processed ${processedCount} papers`);
    }

    return results;
  }
}