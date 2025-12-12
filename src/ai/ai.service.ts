import { GenerateContentConfig, GoogleGenAI, Part } from '@google/genai';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AI_OPTIONS_TOKEN } from './ai.contants';
import { AIOptions } from './ai.types';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private genai: GoogleGenAI;
  constructor(
    @Inject(AI_OPTIONS_TOKEN)
    private readonly _options: AIOptions,
  ) {}
  onModuleInit() {
    this.genai = new GoogleGenAI({
      apiKey: this.options.geminiApiKey,
    });
  }

  /**
   * Converts a file buffer to a GenerativePart object with Base64 data.
   * @param {Buffer} buffer The file buffer.
   * @param {string} mimeType The MIME type of the file.
   */
  fileToGenerativePart(buffer: Buffer, mimeType: string): Part {
    // Read the file as a Buffer and convert it to a Base64 string
    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType,
      },
    };
  }

  cleanResponseText(responseText: string) {
    return responseText
      .trim()
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '');
  }

  generateContentStream(contents: Part[], config: GenerateContentConfig) {
    return this.genai.models.generateContentStream({
      model: this._options.model,
      contents: [{ role: 'user', parts: contents }],
      config,
    });
  }

  generateContent(contents: Part[], config: GenerateContentConfig) {
    return this.genai.models.generateContent({
      model: this.options.model,
      contents: [{ role: 'user', parts: contents }],
      config,
    });
  }

  get options() {
    return this._options;
  }
}
