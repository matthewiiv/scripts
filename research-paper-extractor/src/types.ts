export interface PaperInput {
  Section: string;
  PaperName: string;
  Link: string;
}

export interface AuthorContact {
  name: string;
  nationality: string;
  linkedin: string;
  email: string;
  paper_link: string;
  notes: string;
}

export interface ProcessingResult {
  paperName: string;
  authors: AuthorContact[];
  error?: string;
}

export interface CLIOptions {
  papers: string;
  output: string;
  europeanOutput: string;
  dryRun: boolean;
  concurrency: number;
  apiKey?: string;
}