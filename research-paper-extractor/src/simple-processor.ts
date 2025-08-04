import pLimit from 'p-limit';
import { PaperInput, ProcessingResult, AuthorContact } from './types';
import { OpenAIResponsesClient } from './openai-client-responses';
import { isEuropeanOrUK } from './csv-handler';
import { appendToCSVSafe } from './csv-writer-safe';

export class SimplePaperProcessor {
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
    let processing = 0;
    const total = papers.length;
    
    console.log('\n📄 Research Paper Contact Extractor\n');
    console.log(`Processing ${total} papers with concurrency ${concurrency}...\n`);

    const processingTasks = papers.map((paper, index) => 
      limit(async () => {
        try {
          processing++;
          console.log(`🔄 [${completed}/${total}] Processing paper #${index + 1}: ${paper.PaperName}`);

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
            
            processing--;
            completed++;
            console.log(`✅ [${completed}/${total}] Completed paper #${index + 1}: ${paper.PaperName} - 1 author found`);
            
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
              await appendToCSVSafe(this.outputPath, authors);
              
              // Filter and write European/UK authors to the European output file
              const europeanAuthors = authors.filter(author => isEuropeanOrUK(author.nationality));
              if (europeanAuthors.length > 0) {
                await appendToCSVSafe(this.europeanOutputPath, europeanAuthors);
              }
            }
            
            processing--;
            completed++;
            console.log(`✅ [${completed}/${total}] Completed paper #${index + 1}: ${paper.PaperName} - ${authors.length} authors found (${duration}s)`);
            
            results.push({
              paperName: paper.PaperName,
              authors
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          processing--;
          completed++;
          console.log(`❌ [${completed}/${total}] Failed paper #${index + 1}: ${paper.PaperName} - Error: ${errorMessage}`);
          
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
    const errorCount = results.filter(r => r.error).length;
    
    console.log(`\n✨ Processing complete!`);
    console.log(`Papers processed: ${successCount}/${papers.length}`);
    console.log(`Total authors extracted: ${totalAuthors}`);
    if (errorCount > 0) {
      console.log(`Errors encountered: ${errorCount}`);
    }

    return results;
  }
}