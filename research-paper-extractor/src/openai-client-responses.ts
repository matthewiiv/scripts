import OpenAI from "openai";
import { AuthorContact } from "./types";

export class OpenAIResponsesClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async extractAuthorContacts(
    paperLink: string,
    paperName: string
  ): Promise<AuthorContact[]> {
    const instructions = `You are an expert at researching people's contact information from academic papers. 
Extract ALL authors from the paper and return them in a specific JSON format.
For ALL authors, include their name and nationality.
For authors from Europe or the United Kingdom ONLY, also find their LinkedIn and email contact information.
For non-European/UK authors, set linkedin and email to "Not found".

Return a JSON object with a single key "authors" containing an array of author objects.
Each author object must have exactly these fields:
- name: string (author's full name)
- nationality: string (author's nationality)
- linkedin: string (LinkedIn URL for EU/UK authors, "Not found" for others)
- email: string (email address for EU/UK authors, "Not found" for others)
- notes: string (any additional relevant information)`;

    const input = `For the following paper, extract information for ALL authors:
Paper: ${paperName}
Link: ${paperLink}

List ALL authors from the paper. Only research contact information (LinkedIn, email) for those from Europe or the United Kingdom.`;

    try {
      const response = await this.client.responses.create({
        model: "o3-pro",
        instructions: instructions,
        input:
          input +
          "\n\nIMPORTANT: Return your response as valid JSON only, with no additional text or markdown formatting.",
      });

      // Parse the response
      const outputText = response.output_text || "";

      // Try to extract JSON from the response
      let authors: AuthorContact[] = [];

      // First try to parse the entire response as JSON
      try {
        const parsed = JSON.parse(outputText);
        if (Array.isArray(parsed)) {
          authors = parsed;
        } else if (parsed.authors && Array.isArray(parsed.authors)) {
          authors = parsed.authors;
        }
      } catch {
        // If not valid JSON, try to extract JSON from the text
        const jsonMatch = outputText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              authors = parsed;
            } else if (parsed.authors && Array.isArray(parsed.authors)) {
              authors = parsed.authors;
            }
          } catch (e) {
            console.error("Failed to parse JSON from response:", e);
          }
        }
      }

      // Ensure all authors have the required fields and add paper_link
      return authors.map((author: any) => ({
        name: author.name || "Unknown",
        nationality: author.nationality || "Unknown",
        linkedin: author.linkedin || "Not found",
        email: author.email || "Not found",
        paper_link: paperLink,
        notes: author.notes || "",
      }));
    } catch (error) {
      console.error("Error in responses API:", error);
      throw error;
    }
  }
}
