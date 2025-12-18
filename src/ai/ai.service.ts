import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import { AI_OPTIONS_TOKEN } from './ai.contants';
import {
  AIOptions,
  GenerateContentConfig,
  GenerateContentResponse,
  GenerateParsedContentResponse,
  Part,
} from './ai.types';
import z from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;
  constructor(
    @Inject(AI_OPTIONS_TOKEN)
    private readonly _options: AIOptions,
  ) {}
  onModuleInit() {
    this.openai = new OpenAI({
      apiKey: this._options.apiKey,
      baseURL: this._options.baseURL,
    });
    this.logger.log(
      `OpenAI client initialized with options: ${JSON.stringify(this._options, null, 2)}`,
    );
  }

  /**
   * Converts a file buffer to a Part object with Base64 data URL.
   * @param {Buffer} buffer The file buffer.
   * @param {string} mimeType The MIME type of the file.
   */
  fileToGenerativePart(buffer: Buffer, mimeType: string): Part {
    // Convert buffer to base64 data URL for OpenAI
    const base64 = buffer.toString('base64');
    return {
      image: {
        url: `data:${mimeType};base64,${base64}`,
      },
    };
  }

  cleanResponseText(responseText: string) {
    return responseText
      .trim()
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '');
  }

  async generateContentStream(
    contents: Part[],
    config: GenerateContentConfig,
  ): Promise<GenerateContentResponse> {
    let responseText: string = '';
    let usageMetadata: GenerateContentResponse['usageMetadata'] | undefined;
    let modelVersion: string | undefined;

    try {
      // Convert Part[] to OpenAI message format
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: contents.map((part) => {
            if (part.text) {
              return { type: 'text', text: part.text };
            }
            if (part.image?.url) {
              return {
                type: 'image_url',
                image_url: { url: part.image.url },
              };
            }
            return { type: 'text', text: '' };
          }),
        },
      ];

      const stream = await this.openai.chat.completions.create({
        model: this._options.model,
        messages,
        ...config,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          responseText += content;
        }
        // Capture model from any chunk
        if (chunk.model) {
          modelVersion = chunk.model;
        }
        // Usage metadata comes in the final chunk (when finish_reason is set)
        if (chunk.usage) {
          usageMetadata = {
            promptTokenCount: chunk.usage.prompt_tokens,
            candidatesTokenCount: chunk.usage.completion_tokens,
            totalTokenCount: chunk.usage.total_tokens,
          };
        }
      }

      return {
        text: responseText,
        modelVersion,
        usageMetadata,
      };
    } catch (error) {
      this.logger.error(`Error generating content: ${error}`);
      throw error;
    }
  }

  async generateParsedContent<T>(
    contents: Part[],
    config: GenerateContentConfig & { response_schema: z.ZodSchema<T> },
  ): Promise<GenerateParsedContentResponse<T>> {
    try {
      // Convert Part[] to OpenAI message format
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content:
            'You are a helpful assistant that can extract data from images and text.',
        },
        {
          role: 'user',
          content: contents.map((part) => {
            if (part.text) {
              return { type: 'text', text: part.text };
            }
            if (part.image?.url) {
              return {
                type: 'image_url',
                image_url: { url: part.image.url },
              };
            }
            return { type: 'text', text: '' };
          }),
        },
      ];

      const response = await this.openai.chat.completions.parse({
        model: this._options.model,
        messages,
        ...config,
        response_format: zodResponseFormat(
          config.response_schema,
          'responseDto',
        ),
      });

      const parsedData = response.choices[0]?.message?.parsed ?? undefined;
      const usageMetadata = response.usage
        ? {
            promptTokenCount: response.usage.prompt_tokens,
            candidatesTokenCount: response.usage.completion_tokens,
            totalTokenCount: response.usage.total_tokens,
          }
        : undefined;

      return {
        data: parsedData,
        modelVersion: response.model,
        usageMetadata,
      };
    } catch (error) {
      this.logger.error(`Error generating content: ${error}`);
      throw error;
    }
  }
  async generateContent(
    contents: Part[],
    config: GenerateContentConfig,
  ): Promise<GenerateContentResponse> {
    try {
      // Convert Part[] to OpenAI message format
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: contents.map((part) => {
            if (part.text) {
              return { type: 'text', text: part.text };
            }
            if (part.image?.url) {
              return {
                type: 'image_url',
                image_url: { url: part.image.url },
              };
            }
            return { type: 'text', text: '' };
          }),
        },
      ];

      const response = await this.openai.chat.completions.create({
        model: this._options.model,
        messages,
        ...config,
        response_format: undefined,
      });

      const responseText = response.choices[0]?.message?.content ?? '';
      const usageMetadata = response.usage
        ? {
            promptTokenCount: response.usage.prompt_tokens,
            candidatesTokenCount: response.usage.completion_tokens,
            totalTokenCount: response.usage.total_tokens,
          }
        : undefined;

      return {
        text: responseText,
        modelVersion: response.model,
        usageMetadata,
      };
    } catch (error) {
      this.logger.error(`Error generating content: ${error}`);
      throw error;
    }
  }

  get options() {
    return this._options;
  }
}
