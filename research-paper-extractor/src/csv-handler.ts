import fs from 'fs';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { PaperInput, AuthorContact } from './types';

export async function readPapersFromCSV(filePath: string): Promise<PaperInput[]> {
  const papers: PaperInput[] = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => {
        papers.push({
          Section: data.Section,
          PaperName: data.PaperName,
          Link: data.Link
        });
      })
      .on('end', () => resolve(papers))
      .on('error', reject);
  });
}

export async function appendToCSV(outputPath: string, authors: AuthorContact[]) {
  const fileExists = fs.existsSync(outputPath);
  
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'name', title: 'Name' },
      { id: 'nationality', title: 'Nationality' },
      { id: 'linkedin', title: 'LinkedIn' },
      { id: 'email', title: 'Email' },
      { id: 'paper_link', title: 'Link to Paper' },
      { id: 'notes', title: 'Notes' }
    ],
    append: fileExists
  });

  await csvWriter.writeRecords(authors);
}

export function isEuropeanOrUK(nationality: string): boolean {
  const europeanCountries = [
    'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czech republic', 'czechia',
    'denmark', 'estonia', 'finland', 'france', 'germany', 'german', 'greece', 'greek', 'hungary',
    'ireland', 'irish', 'italy', 'italian', 'latvia', 'lithuania', 'luxembourg', 'malta', 
    'netherlands', 'dutch', 'poland', 'polish', 'portugal', 'portuguese', 'romania', 'romanian',
    'slovakia', 'slovenia', 'spain', 'spanish', 'sweden', 'swedish',
    'united kingdom', 'uk', 'british', 'english', 'scottish', 'welsh', 'northern irish',
    'swiss', 'switzerland', 'norway', 'norwegian', 'iceland', 'liechtenstein',
    'ukraine', 'ukrainian', 'serbian', 'serbia', 'montenegro', 'macedonian', 'macedonia',
    'albanian', 'albania', 'bosnian', 'bosnia', 'croatian', 'belgian', 'finnish',
    'danish', 'estonian', 'hungarian', 'latvian', 'lithuanian', 'slovakian', 'slovenian'
  ];
  
  const normalizedNationality = nationality.toLowerCase().trim();
  return europeanCountries.some(country => normalizedNationality.includes(country));
}