import * as pdfjs from 'pdfjs-dist';
import { type TextItem } from 'pdfjs-dist/types/src/display/api.js';
import { type ContentPage } from '../document.js';

export async function extractTextFromPdf(data: Buffer): Promise<ContentPage[]> {
  const pages: ContentPage[] = [];
  
  try {
    // Enable better logging for PDF.js
    const verboseErrors = true;
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(data),
      verbosity: verboseErrors ? 1 : 0,
      useSystemFonts: true, // Try using system fonts for better character support
    }).promise;
    
    let offset = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        let previousY = 0;
        const text = textContent.items
          .filter((item) => 'str' in item)
          .map((item) => {
            const textItem = item as TextItem;
            const y = textItem.transform[5];
            let textContent = textItem.str;
            if (y !== previousY && previousY !== 0) {
              textContent = '\n' + textContent;
            }
            previousY = y;
            return textContent;
          })
          .join('');

        // Log the first few characters of each page for debugging
        console.debug(`Page ${i} start: "${text.slice(0, 100)}..."`);
        
        pages.push({ 
          content: text + '\n', 
          offset, 
          page: i 
        });
        offset += text.length;
      } catch (pageError) {
        console.error(`Error processing page ${i}:`, pageError);
        // Continue with next page instead of failing completely
        pages.push({ 
          content: `[Error processing page ${i}]`, 
          offset, 
          page: i 
        });
        offset += 24; // Length of error message
      }
    }
    return pages;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('PDF processing error:', error);
    throw new Error(`Failed to process PDF: ${errorMessage}`);
  }
}
