/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import z from 'zod';
import { AIInteractionType } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AI_OPTIONS_TOKEN } from './ai.contants';
import {
  AIOptions,
  GenerateContentConfig,
  GenerateContentResponse,
  GenerateParsedContentResponse,
  Part,
} from './ai.types';
import { safeParseJson } from '../app.utils';
import { Results } from 'src/common/common.interfaces';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;
  constructor(
    @Inject(AI_OPTIONS_TOKEN)
    private readonly _options: AIOptions,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
  ) {}
  onModuleInit() {
    this.openai = new OpenAI({
      apiKey: this._options.apiKey,
      baseURL: this._options.baseURL + '/v1',
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

  buildMessages(
    contents: Part[],
    config: GenerateContentConfig,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Inject system prompt if provided
    if (config.systemPrompt) {
      messages.push({
        role: 'system',
        content: config.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: contents.map((part) => {
        if (part.text) return { type: 'text', text: part.text };
        if (part.image?.url)
          return { type: 'image_url', image_url: { url: part.image.url } };
        return { type: 'text', text: '' };
      }),
    });

    return messages;
  }
  async generateContentFromStream(
    contents: Part[],
    { systemPrompt, ...config }: GenerateContentConfig,
  ): Promise<GenerateContentResponse> {
    let responseText: string = '';
    let usageMetadata: GenerateContentResponse['usageMetadata'] | undefined;
    let modelVersion: string | undefined;

    try {
      // Convert Part[] to OpenAI message format
      const messages = this.buildMessages(contents, {
        ...config,
        systemPrompt,
      });
      const stream = await this.openai.chat.completions.create({
        model: config.model || this._options.model,
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
    {
      systemPrompt,
      ...config
    }: GenerateContentConfig & {
      response_schema: z.ZodSchema<T>;
    },
  ): Promise<GenerateParsedContentResponse<T>> {
    try {
      // Convert Part[] to OpenAI message format
      const messages = this.buildMessages(contents, {
        ...config,
        systemPrompt,
      });
      const response = await this.openai.chat.completions.parse({
        model: config.model || this._options.model,
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
    { systemPrompt, ...config }: GenerateContentConfig,
  ): Promise<GenerateContentResponse> {
    try {
      // Convert Part[] to OpenAI message format
      const messages = this.buildMessages(contents, {
        ...config,
        systemPrompt,
      });
      const response = await this.openai.chat.completions.create({
        model: config.model || this._options.model,
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

  async callAIAndStore(
    prompt: string,
    files: Array<{ buffer: Buffer; mimeType: string }> | undefined,
    { streamed, ...config }: GenerateContentConfig & { streamed?: boolean },
    interactionType: AIInteractionType,
    entityType: string,
    userId?: string,
  ) {
    let responseText = '';
    let aiResponse: GenerateContentResponse | null = null;

    try {
      const parts = [
        { text: prompt },
        ...(files
          ? files.map((file) =>
              this.fileToGenerativePart(file.buffer, file.mimeType),
            )
          : []),
      ];

      if (streamed) {
        aiResponse = await this.generateContentFromStream(parts, config);
      } else {
        aiResponse = await this.generateContent(parts, config);
      }
      responseText = aiResponse.text?.trim() ?? '';
      this.logger.debug(`AI Response: ${responseText}`);

      return await this.prismaService.aIInteraction.create({
        data: {
          prompt: prompt.substring(0, 10000), // Truncate for storage
          response: responseText,
          aiModel: config.model || this.options.model,
          modelVersion: aiResponse?.modelVersion,
          interactionType,
          entityType,
          tokenUsage: aiResponse?.usageMetadata as any,
          callSuccess: true,
          userId,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Error in ${interactionType}:`, error);
      return await this.prismaService.aIInteraction.create({
        data: {
          prompt: prompt.substring(0, 10000),
          response: responseText,
          aiModel: config.model || this.options.model,
          modelVersion: aiResponse?.modelVersion,
          interactionType,
          entityType,
          tokenUsage: aiResponse?.usageMetadata as any,
          callError: error?.message ?? 'Unknown error',
          callSuccess: false,
          userId,
        },
      });
    }
  }

  async callAIAndStoreParsed<T extends Record<string, any>>(
    prompt: string,
    files: Array<{ buffer: Buffer; mimeType: string }> | undefined,
    {
      schema,
      transformResponse,
      ...config
    }: GenerateContentConfig & {
      streamed?: boolean;
      schema: z.ZodType<T>;
      transformResponse?: (response: T) => T;
    },
    interactionType: AIInteractionType,
    entityType: string,
    userId?: string,
  ) {
    const interaction = await this.callAIAndStore(
      prompt,
      files,
      config,
      interactionType,
      entityType,
      userId,
    );
    const parsedResults = await this.parseAndValidate(
      interaction.response,
      schema,
      (error: Error) => error,
      transformResponse,
    );

    if (!parsedResults.success) {
      return await this.prismaService.aIInteraction.update({
        where: { id: interaction.id },
        data: {
          parseError: JSON.parse(
            parsedResults.error?.message ?? JSON.stringify({}),
          ),
          parseSuccess: false,
        },
      });
    }

    return await this.prismaService.aIInteraction.update({
      where: { id: interaction.id },
      data: {
        parsedResponse: parsedResults.data,
        parseSuccess: true,
      },
    });
  }

  /**
   * Parse AI response and validate against schema
   */
  async parseAndValidate<T extends Record<string, any>, E>(
    response: string,
    schema: z.ZodType<T>,
    onError: (error: unknown) => E | Promise<E>,
    transformResponse?: (response: T) => T,
  ): Promise<Results<T, E>> {
    try {
      // Clean and parse JSON
      const transformer = transformResponse ?? ((response: T) => response);
      const cleanedResponse = this.cleanResponseText(response);
      const parsedResult = safeParseJson<Record<string, any>>(cleanedResponse, {
        transformNullToUndefined: true,
      });

      if (!parsedResult.success) {
        throw new Error(
          JSON.stringify({
            message: 'JSON parsing failed',
            error: `${parsedResult.error.message}`,
          }),
        );
      }

      // Validate against schema
      const validation = await schema.safeParseAsync(
        transformer(parsedResult.data as T),
      );

      if (!validation.success) {
        throw new Error(
          JSON.stringify({
            message: 'Schema validation failed',
            error: z.formatError(validation.error),
          }),
        );
      }

      return { success: true, data: validation.data };
    } catch (error: unknown) {
      return { success: false, error: await onError?.(error) };
    }
  }
}
