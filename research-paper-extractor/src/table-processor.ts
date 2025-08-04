import pLimit from 'p-limit';
import Table from 'cli-table3';
import { PaperInput, ProcessingResult, AuthorContact } from './types';
import { OpenAIResponsesClient } from './openai-client-responses';
import { appendToCSV, isEuropeanOrUK } from './csv-handler';

interface PaperStatus {
  index: number;
  paperName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  duration?: string;
  authorCount?: number;
  error?: string;
}

export class TablePaperProcessor {
  private openAIClient: OpenAIResponsesClient;
  private dryRun: boolean;
  private outputPath: string;
  private europeanOutputPath: string;
  private paperStatuses: Map<string, PaperStatus> = new Map();

  constructor(apiKey: string, outputPath: string, europeanOutputPath: string, dryRun: boolean = false) {
    this.openAIClient = new OpenAIResponsesClient(apiKey);
    this.dryRun = dryRun;
    this.outputPath = outputPath;
    this.europeanOutputPath = europeanOutputPath;
  }

  private isFirstRender = true;
  private lastRenderTime = 0;
  private renderDelay = 500; // Only update every 500ms

  private renderTable(force: boolean = false) {
    const now = Date.now();
    if (!force && now - this.lastRenderTime < this.renderDelay) {
      return; // Skip render if too soon
    }
    this.lastRenderTime = now;
    const table = new Table({
      head: ['#', 'Paper', 'Status', 'Time', 'Authors'],
      colWidths: [5, 50, 15, 10, 10],
      style: { head: ['cyan'] }
    });

    const statuses = Array.from(this.paperStatuses.values()).sort((a, b) => a.index - b.index);
    
    for (const status of statuses) {
      const statusDisplay = status.status === 'processing' ? '🔄 Processing' :
                          status.status === 'completed' ? '✅ Completed' :
                          status.status === 'error' ? '❌ Error' :
                          '⏳ Pending';
      
      table.push([
        status.index.toString(),
        status.paperName.length > 47 ? status.paperName.substring(0, 44) + '...' : status.paperName,
        statusDisplay,
        status.duration || '-',
        status.authorCount !== undefined ? status.authorCount.toString() : '-'
      ]);
    }

    // Clear screen and move cursor to top
    if (this.isFirstRender) {
      console.log('\n📄 Research Paper Contact Extractor\n');
      this.isFirstRender = false;
    } else {
      // Move cursor up to overwrite previous table
      const lines = statuses.length + 10; // table lines + headers + status messages
      process.stdout.write(`\x1b[${lines}A`); // Move cursor up
      process.stdout.write('\x1b[0J'); // Clear from cursor to end of screen
    }
    
    console.log(table.toString());
    
    // Show current processing papers
    const processing = statuses.filter(s => s.status === 'processing');
    if (processing.length > 0) {
      console.log(`\n🔄 Currently processing ${processing.length} paper${processing.length > 1 ? 's' : ''}...`);
    } else {
      console.log('\n'); // Keep spacing consistent
    }
    
    // Show errors if any
    const errors = statuses.filter(s => s.status === 'error');
    if (errors.length > 0) {
      console.log('❌ Errors:');
      errors.forEach(e => {
        console.log(`   ${e.paperName}: ${e.error}`);
      });
    }
  }

  async processPapers(papers: PaperInput[], concurrency: number = 3): Promise<ProcessingResult[]> {
    const limit = pLimit(concurrency);
    const results: ProcessingResult[] = [];

    // Initialize paper statuses
    papers.forEach((paper, index) => {
      this.paperStatuses.set(paper.Link, {
        index: index + 1,
        paperName: paper.PaperName,
        status: 'pending'
      });
    });

    // Initial render
    this.renderTable();

    const processingTasks = papers.map((paper, index) => 
      limit(async () => {
        try {
          // Update status to processing
          this.paperStatuses.get(paper.Link)!.status = 'processing';
          this.renderTable(true);

          const startTime = Date.now();

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
            
            this.paperStatuses.get(paper.Link)!.status = 'completed';
            this.paperStatuses.get(paper.Link)!.duration = '1s';
            this.paperStatuses.get(paper.Link)!.authorCount = mockAuthors.length;
            
            results.push({
              paperName: paper.PaperName,
              authors: mockAuthors
            });
          } else {
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
            
            this.paperStatuses.get(paper.Link)!.status = 'completed';
            this.paperStatuses.get(paper.Link)!.duration = `${duration}s`;
            this.paperStatuses.get(paper.Link)!.authorCount = authors.length;
            
            results.push({
              paperName: paper.PaperName,
              authors
            });
          }
          
          this.renderTable(true);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          this.paperStatuses.get(paper.Link)!.status = 'error';
          this.paperStatuses.get(paper.Link)!.error = errorMessage;
          
          results.push({
            paperName: paper.PaperName,
            authors: [],
            error: errorMessage
          });
          
          this.renderTable(true);
        }
      })
    );

    await Promise.all(processingTasks);

    // Final summary
    const completed = results.filter(r => !r.error).length;
    const totalAuthors = results.reduce((sum, r) => sum + r.authors.length, 0);
    
    console.log(`\n✨ Processing complete!`);
    console.log(`Papers processed: ${completed}/${papers.length}`);
    console.log(`Total authors extracted: ${totalAuthors}`);

    return results;
  }
}