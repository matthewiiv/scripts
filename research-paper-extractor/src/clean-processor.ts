import pLimit from 'p-limit';
import Table from 'cli-table3';
import { PaperInput, ProcessingResult, AuthorContact } from './types';
import { OpenAIResponsesClient } from './openai-client-responses';
import { appendToCSV, isEuropeanOrUK } from './csv-handler';

export class CleanPaperProcessor {
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
    let completed = 0;
    const total = papers.length;

    console.log('\n📄 Research Paper Contact Extractor\n');
    console.log(`Processing ${total} papers with concurrency ${concurrency}...\n`);

    // Print initial table
    const table = new Table({
      head: ['#', 'Paper', 'Link'],
      colWidths: [5, 60, 85],
      style: { head: ['cyan'] }
    });

    papers.forEach((paper, index) => {
      table.push([
        (index + 1).toString(),
        paper.PaperName.length > 57 ? paper.PaperName.substring(0, 54) + '...' : paper.PaperName,
        paper.Link.length > 82 ? paper.Link.substring(0, 79) + '...' : paper.Link
      ]);
    });

    console.log(table.toString());
    console.log('\n🔄 Processing papers...\n');

    const processingTasks = papers.map((paper, index) => 
      limit(async () => {
        try {
          if (this.dryRun) {
            // Simulate processing time in dry run
            await new Promise(resolve => setTimeout(resolve, 1000));
            
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
            
            completed++;
            console.log(`✓ [${completed}/${total}] Paper #${index + 1}: ${paper.PaperName} - 1s - 1 author`);
            
            results.push({
              paperName: paper.PaperName,
              authors: mockAuthors
            });
          } else {
            const startTime = Date.now();
            const authors = await this.openAIClient.extractAuthorContacts(paper.Link, paper.PaperName);
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            if (authors.length > 0) {
              // Write all authors to the main output file
              await appendToCSV(this.outputPath, authors);
              
              // Filter and write European/UK authors to the European output file
              const europeanAuthors = authors.filter(author => isEuropeanOrUK(author.nationality));
              if (europeanAuthors.length > 0) {
                await appendToCSV(this.europeanOutputPath, europeanAuthors);
              }
            }
            
            completed++;
            console.log(`✓ [${completed}/${total}] Paper #${index + 1}: ${paper.PaperName} - ${duration}s - ${authors.length} authors`);
            
            results.push({
              paperName: paper.PaperName,
              authors
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          completed++;
          console.log(`✗ [${completed}/${total}] Paper #${index + 1}: ${paper.PaperName} - Error: ${errorMessage}`);
          
          results.push({
            paperName: paper.PaperName,
            authors: [],
            error: errorMessage
          });
        }
      })
    );

    await Promise.all(processingTasks);

    // Final summary
    const successCount = results.filter(r => !r.error).length;
    const totalAuthors = results.reduce((sum, r) => sum + r.authors.length, 0);
    
    console.log(`\n✨ Processing complete!`);
    console.log(`Papers processed: ${successCount}/${total}`);
    console.log(`Total authors extracted: ${totalAuthors}`);
    if (results.some(r => r.error)) {
      console.log(`Errors encountered: ${results.filter(r => r.error).length}`);
    }

    return results;
  }
}