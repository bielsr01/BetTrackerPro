import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OCRResult } from '../shared/schema';

export class PdfPlumberService {
  private readonly tempDir = '/tmp';
  private readonly pythonScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pdf', 'parse_pdf.py');
  private readonly timeout = 30000; // 30 segundos timeout

  async processDocument(
    fileBuffer: Buffer, 
    filename: string, 
    mimeType: string,
    customPrompt?: string
  ): Promise<OCRResult> {
    console.log(`Processing PDF with pdfplumber: ${filename}, size: ${fileBuffer.length} bytes`);
    console.log(`Custom prompt provided: ${customPrompt ? 'Yes' : 'No'}`);
    
    // Valida que é um PDF
    if (mimeType !== 'application/pdf') {
      throw new Error(`Unsupported file type: ${mimeType}. Only PDF files are supported.`);
    }

    // Valida assinatura do PDF
    if (!fileBuffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      throw new Error('Invalid PDF file: missing PDF signature');
    }

    console.log('Processing application/pdf with pdfplumber');

    // Cria arquivo temporário
    const tempFilePath = path.join(this.tempDir, `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`);
    
    try {
      await fs.writeFile(tempFilePath, fileBuffer);
      console.log(`Temporary PDF file created: ${tempFilePath}`);

      // Executa script Python
      const result = await this.executePythonScript(tempFilePath);
      
      console.log('pdfplumber Raw Response:', JSON.stringify(result, null, 2));

      return this.validateAndCleanResult(result);

    } finally {
      // Limpa arquivo temporário
      try {
        await fs.unlink(tempFilePath);
        console.log(`Temporary file cleaned: ${tempFilePath}`);
      } catch (error) {
        console.warn(`Failed to clean temporary file: ${tempFilePath}`, error instanceof Error ? error.message : error);
      }
    }
  }

  private async executePythonScript(pdfPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonScript, pdfPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (stderr) {
          console.warn('Python script stderr:', stderr);
        }

        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          reject(new Error(`Failed to parse Python script output: ${errorMessage}\nOutput: ${stdout}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });

      // Timeout handling
      setTimeout(() => {
        python.kill('SIGKILL');
        reject(new Error(`Python script timeout after ${this.timeout}ms`));
      }, this.timeout);
    });
  }

  private validateAndCleanResult(data: any): OCRResult {
    // Garante que o resultado segue a estrutura OCRResult
    const result: OCRResult = {
      date: data.date || null,
      sport: data.sport || null,
      league: data.league || null,
      teamA: data.teamA || null,
      teamB: data.teamB || null,
      bet1: {
        house: data.bet1?.house || null,
        odd: data.bet1?.odd || null,
        type: data.bet1?.type || null,
        stake: data.bet1?.stake || null,
        profit: data.bet1?.profit || null
      },
      bet2: {
        house: data.bet2?.house || null,
        odd: data.bet2?.odd || null,
        type: data.bet2?.type || null,
        stake: data.bet2?.stake || null,
        profit: data.bet2?.profit || null
      },
      profitPercentage: data.profitPercentage || null
    };

    // Add bet3 if it exists (supports triple bets)
    if (data.bet3 && (data.bet3.house || data.bet3.type || data.bet3.odd)) {
      result.bet3 = {
        house: data.bet3.house || null,
        odd: data.bet3.odd || null,
        type: data.bet3.type || null,
        stake: data.bet3.stake || null,
        profit: data.bet3.profit || null
      };
    }

    return result;
  }
}