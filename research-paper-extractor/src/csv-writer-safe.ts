import { promises as fs } from 'fs';
import { AuthorContact } from './types';
import { Mutex } from 'async-mutex';

// Create separate mutexes for each output file
const allAuthorsMutex = new Mutex();
const europeanAuthorsMutex = new Mutex();

export async function appendToCSVSafe(filePath: string, authors: AuthorContact[]): Promise<void> {
  if (authors.length === 0) return;

  // Determine which mutex to use based on the file path
  const mutex = filePath.includes('european') ? europeanAuthorsMutex : allAuthorsMutex;

  // Acquire lock before writing
  const release = await mutex.acquire();
  
  try {
    // Check if file exists
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    
    // Convert authors to CSV format
    const rows = authors.map(author => {
      const row = [
        author.name,
        author.nationality,
        author.linkedin || '',
        author.email || '',
        author.paper_link,
        author.notes || ''
      ];
      
      // Escape fields that contain commas or quotes
      return row.map(field => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      }).join(',');
    });
    
    // Add header if file doesn't exist
    if (!fileExists) {
      const header = 'Name,Nationality,LinkedIn,Email,Link to Paper,Notes';
      rows.unshift(header);
    }
    
    // Append to file with newline
    const content = rows.join('\n') + '\n';
    await fs.appendFile(filePath, content, 'utf-8');
    
  } finally {
    // Always release the lock
    release();
  }
}