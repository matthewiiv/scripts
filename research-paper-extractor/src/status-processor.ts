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

export class StatusPaperProcessor {
  private openAIClient: OpenAIResponsesClient;
  private dryRun: boolean;
  private outputPath: string;
  private europeanOutputPath: string;
  private paperStatuses: Map<string, PaperStatus> = new Map();
  private lastTableHeight = 0;

  constructor(apiKey: string, outputPath: string, europeanOutputPath: string, dryRun: boolean = false) {
    this.openAIClient = new OpenAIResponsesClient(apiKey);
    this.dryRun = dryRun;
    this.outputPath = outputPath;
    this.europeanOutputPath = europeanOutputPath;
  }

  private renderTable() {
    // Move cursor to beginning of table
    if (this.lastTableHeight > 0) {
      process.stdout.write(`\x1b[${this.lastTableHeight}A`);
    }

    const table = new Table({
      head: ['#', 'Paper', 'Status', 'Time', 'Authors'],
      colWidths: [5, 50, 15, 10, 10],
      style: { head: ['cyan'] }
    });

    const statuses = Array.from(this.paperStatuses.values()).sort((a, b) => a.index - b.index);
    
    // Show first 10 papers and current processing ones
    let displayStatuses = statuses.slice(0, 10);
    
    // Add any currently processing papers not in first 10
    const processing = statuses.filter(s => s.status === 'processing' && s.index > 10);
    if (processing.length > 0) {
      displayStatuses.push({ index: 0, paperName: '...', status: 'pending' } as PaperStatus);
      displayStatuses = displayStatuses.concat(processing);
    }
    
    // Add last few completed if we have room
    const completed = statuses.filter(s => s.status === 'completed').slice(-3);
    if (completed.length > 0 && displayStatuses.length < 15) {
      if (!displayStatuses.find(s => s.paperName === '...')) {
        displayStatuses.push({ index: 0, paperName: '...', status: 'pending' } as PaperStatus);
      }
      displayStatuses = displayStatuses.concat(completed);
    }

    for (const status of displayStatuses) {
      if (status.paperName === '...') {
        table.push(['...', '...', '...', '...', '...']);
        continue;
      }

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

    const output = table.toString();
    const lines = output.split('\n');
    this.lastTableHeight = lines.length + 4; // Table lines + status line + spacing

    console.log(output);
    
    // Show summary
    const completedCount = statuses.filter(s => s.status === 'completed').length;
    const processingCount = statuses.filter(s => s.status === 'processing').length;
    const errorCount = statuses.filter(s => s.status === 'error').length;
    
    console.log(`\n📊 Progress: ${completedCount}/${statuses.size} completed, ${processingCount} processing, ${errorCount} errors\n`);
  }

  async processPapers(papers: PaperInput[], concurrency: number = 3): Promise<ProcessingResult[]> {
    const limit = pLimit(concurrency);
    const results: ProcessingResult[] = [];

    console.log('\n📄 Research Paper Contact Extractor\n');
    console.log(`Processing ${papers.length} papers with concurrency ${concurrency}...\n`);

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
          this.renderTable();

          if (this.dryRun) {
            // Simulate processing time in dry run
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            
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
            const startTime = Date.now();
            const authors = await this.openAIClient.extractAuthorContacts(paper.Link, paper.PaperName);
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            if (authors.length > 0) {
              await appendToCSV(this.outputPath, authors);
              
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
          
          this.renderTable();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          this.paperStatuses.get(paper.Link)!.status = 'error';
          this.paperStatuses.get(paper.Link)!.error = errorMessage;
          
          results.push({
            paperName: paper.PaperName,
            authors: [],
            error: errorMessage
          });
          
          this.renderTable();
        }
      })
    );

    await Promise.all(processingTasks);

    // Clear the table area and show final summary
    if (this.lastTableHeight > 0) {
      process.stdout.write(`\x1b[${this.lastTableHeight}A\x1b[0J`);
    }

    const successCount = results.filter(r => !r.error).length;
    const totalAuthors = results.reduce((sum, r) => sum + r.authors.length, 0);
    
    console.log(`✨ Processing complete!\n`);
    console.log(`Papers processed: ${successCount}/${papers.length}`);
    console.log(`Total authors extracted: ${totalAuthors}`);
    if (results.some(r => r.error)) {
      console.log(`Errors encountered: ${results.filter(r => r.error).length}`);
    }

    return results;
  }
}