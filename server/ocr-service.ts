import type { OCRResult } from "@shared/schema";

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface MistralFileResponse {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

export class OCRService {
  private apiKey: string;
  private baseUrl = "https://api.mistral.ai/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async uploadFile(fileBuffer: Buffer, filename: string): Promise<string> {
    const formData = new FormData();
    
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, filename);
    formData.append('purpose', 'ocr');

    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral Files API error: ${response.status} - ${errorText}`);
    }

    const data: MistralFileResponse = await response.json();
    return data.id;
  }

  private generatePrompt(customPrompt?: string): string {
    if (customPrompt) {
      return customPrompt;
    }

    return `Analise o documento fornecido e extraia EXATAMENTE os dados como aparecem. NÃO use valores padrão, exemplos ou substitutos.

**REGRAS DE EXTRAÇÃO RIGOROSA:**
1. **ZERO FALLBACKS:** Se um campo não estiver visível, deixe vazio/nulo
2. **TIPOS DE APOSTA:** Copie LITERALMENTE cada caractere da coluna "Chance" ou "Mercado"
3. **CASAS DE APOSTAS:** Nome EXATO da primeira coluna de cada linha
4. **ODDS:** Números exatos preservando pontos/vírgulas
5. **VALORES:** Apenas números, ignorando símbolos de moeda
6. **DATA:** Formato AAAA-MM-DD HH:MM do cabeçalho

**Formato de Saída:**
DATA: [AAAA-MM-DD HH:MM ou vazio]
ESPORTE: [nome exato ou vazio]
LIGA: [nome exato ou vazio]
Time A: [nome exato ou vazio]
Time B: [nome exato ou vazio]
APOSTA 1:
Casa: [nome exato ou vazio]
Odd: [valor exato ou vazio]
Tipo: [texto exato da coluna Chance/Mercado ou vazio]
Stake: [valor exato ou vazio]
Lucro: [valor exato ou vazio]
APOSTA 2:
Casa: [nome exato ou vazio]
Odd: [valor exato ou vazio]
Tipo: [texto exato da coluna Chance/Mercado ou vazio]
Stake: [valor exato ou vazio]
Lucro: [valor exato ou vazio]
Lucro%: [valor exato ou vazio]`;
  }

  async processDocument(fileBuffer: Buffer, mimeType: string, customPrompt?: string): Promise<OCRResult> {
    try {
      const prompt = this.generatePrompt(customPrompt);
      let content: any[];

      console.log(`Processing ${mimeType} with Pixtral Large`);

      if (mimeType === 'application/pdf') {
        // Upload PDF to Files API and use file reference
        const fileId = await this.uploadFile(fileBuffer, 'document.pdf');
        console.log(`Uploaded PDF with file ID: ${fileId}`);

        content = [
          {
            type: "text",
            text: prompt
          },
          {
            type: "file",
            file_id: fileId
          }
        ];
      } else {
        // Process images directly with base64
        const base64Image = fileBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64Image}`;

        content = [
          {
            type: "text",
            text: prompt
          },
          {
            type: "image_url",
            image_url: {
              url: dataUri
            }
          }
        ];
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "pixtral-large-2411",
          messages: [
            {
              role: "user",
              content: content
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Mistral API Error:', errorText);
        throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
      }

      const data: MistralResponse = await response.json();
      const responseContent = data.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error('No response content from Mistral API');
      }

      console.log('Pixtral Large Raw Response:', responseContent);

      return this.parseResponse(responseContent);

    } catch (error) {
      console.error('OCR processing error:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseResponse(content: string): OCRResult {
    const extractValue = (text: string, label: string): string => {
      const regex = new RegExp(`${label}:\\s*(.+)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    // Extract main data
    const dateRaw = extractValue(content, 'DATA');
    const sport = extractValue(content, 'ESPORTE');
    const league = extractValue(content, 'LIGA');
    const teamA = extractValue(content, 'Time A');
    const teamB = extractValue(content, 'Time B');
    const profitPercentage = extractValue(content, 'Lucro%');

    console.log('Extracted values:', { dateRaw, sport, league, teamA, teamB, profitPercentage });

    // Process date WITHOUT fallbacks
    let formattedDate = '';
    if (dateRaw && dateRaw.trim() && dateRaw !== 'vazio') {
      const isoMatch = dateRaw.match(/(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
      if (isoMatch) {
        const [, datePart, timePart] = isoMatch;
        formattedDate = `${datePart}T${timePart}`;
      } else {
        const dateMatch = dateRaw.match(/(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2})/);
        if (dateMatch) {
          const [, datePart, timePart] = dateMatch;
          const [day, month, year] = datePart.split('/');
          formattedDate = `${year}-${month}-${day}T${timePart}`;
        }
      }
    }

    // Extract APOSTA 1 data
    const aposta1Section = content.match(/APOSTA 1:([\s\S]*?)(?=APOSTA 2:|$)/)?.[1] || '';
    const bet1House = extractValue(aposta1Section, 'Casa');
    const bet1Odd = extractValue(aposta1Section, 'Odd');
    const bet1Type = extractValue(aposta1Section, 'Tipo');
    const bet1Stake = extractValue(aposta1Section, 'Stake');
    const bet1Profit = extractValue(aposta1Section, 'Lucro');

    // Extract APOSTA 2 data
    const aposta2Section = content.match(/APOSTA 2:([\s\S]*?)(?=Lucro%:|$)/)?.[1] || '';
    const bet2House = extractValue(aposta2Section, 'Casa');
    const bet2Odd = extractValue(aposta2Section, 'Odd');
    const bet2Type = extractValue(aposta2Section, 'Tipo');
    const bet2Stake = extractValue(aposta2Section, 'Stake');
    const bet2Profit = extractValue(aposta2Section, 'Lucro');

    // Process values WITHOUT defaults - return null for empty/invalid values
    const processOdd = (oddStr: string): number | null => {
      if (!oddStr || oddStr.trim() === '' || oddStr === 'vazio') return null;
      const cleaned = oddStr.replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    };

    const processAmount = (amountStr: string): number | null => {
      if (!amountStr || amountStr.trim() === '' || amountStr === 'vazio') return null;
      const cleaned = amountStr.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    };

    const processPercentage = (percentStr: string): number | null => {
      if (!percentStr || percentStr.trim() === '' || percentStr === 'vazio') return null;
      const cleaned = percentStr.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    };

    // Return extracted data with NULLs for missing values - NO FALLBACKS
    return {
      date: formattedDate || null,
      sport: (sport && sport !== 'vazio') ? sport : null,
      league: (league && league !== 'vazio') ? league : null,
      teamA: (teamA && teamA !== 'vazio') ? teamA : null,
      teamB: (teamB && teamB !== 'vazio') ? teamB : null,
      bet1: {
        house: (bet1House && bet1House !== 'vazio') ? bet1House : null,
        odd: processOdd(bet1Odd),
        type: (bet1Type && bet1Type !== 'vazio') ? bet1Type : null,
        stake: processAmount(bet1Stake),
        profit: processAmount(bet1Profit),
      },
      bet2: {
        house: (bet2House && bet2House !== 'vazio') ? bet2House : null,
        odd: processOdd(bet2Odd),
        type: (bet2Type && bet2Type !== 'vazio') ? bet2Type : null,
        stake: processAmount(bet2Stake),
        profit: processAmount(bet2Profit),
      },
      profitPercentage: processPercentage(profitPercentage),
    };
  }

  // Legacy methods for compatibility - all route to new implementation
  async processImage(imageBase64: string, customPrompt?: string): Promise<OCRResult> {
    const buffer = Buffer.from(imageBase64, 'base64');
    return this.processDocument(buffer, 'image/jpeg', customPrompt);
  }

  async processImageFromBuffer(imageBuffer: Buffer, customPrompt?: string): Promise<OCRResult> {
    return this.processDocument(imageBuffer, 'image/jpeg', customPrompt);
  }

  async processFileFromBuffer(fileBuffer: Buffer, mimeType: string, customPrompt?: string): Promise<OCRResult> {
    return this.processDocument(fileBuffer, mimeType, customPrompt);
  }

  async processPDF(pdfBuffer: Buffer, customPrompt?: string): Promise<OCRResult> {
    return this.processDocument(pdfBuffer, 'application/pdf', customPrompt);
  }
}