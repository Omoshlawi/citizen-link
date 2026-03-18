/* eslint-disable @typescript-eslint/unbound-method */
import z from 'zod';
import { Configuration, Value } from '@itgorillaz/configify';
import { ChatModel } from 'openai/resources/chat/chat';

@Configuration()
export class AiConfig {
  @Value('OPENAI_API_KEY', {
    parse: z.string({ message: 'OpenAI API Key is required' }).nonempty().parse,
  })
  openaiApiKey: string;

  @Value('OPENAI_BASE_URL', {
    parse: z.url({ message: 'OpenAI Base URL is required' }).optional().parse,
  })
  aiBaseUrl: string;

  @Value('OPENAI_MODEL', {
    parse: z.string({ message: 'OpenAI Model is required' }).optional().parse,
    default: 'deepseek-chat',
  })
  aiModel: ChatModel;
  @Value('VISION_AI_MODEL', {
    parse: z.string({ message: 'Vision AI Model is required' }).optional()
      .parse,
    default: 'gemma3:4b',
    // default: 'maternion/LightOnOCR-2:1b',
    // default: 'qwen3-vl:8b',
    // default: 'llama3.2-vision:latest',
  })
  visionAiModel: ChatModel;
  @Value('VISION_AI_BASE_URL', {
    parse: z.url({ message: 'Vision AI Base URL is required' }).optional()
      .parse,
  })
  visionAiBaseUrl: string;
  @Value('VISION_AI_API_KEY', {
    parse: z.string({ message: 'Vision AI API Key is required' }).nonempty()
      .parse,
  })
  visionAiApiKey: string;
  @Value('TEXT_EXTRACTION_AI_MODEL', {
    parse: z
      .string({ message: 'Text Extraction AI Model is required' })
      .optional().parse,
    default: 'gemma3:4b',
  })
  textExtractionAiModel: ChatModel;
  @Value('TEXT_EXTRACTION_AI_BASE_URL', {
    parse: z
      .url({ message: 'Text Extraction AI Base URL is required' })
      .optional().parse,
  })
  textExtractionAiBaseUrl?: string;
  @Value('TEXT_EXTRACTION_AI_API_KEY', {
    parse: z
      .string({ message: 'Text Extraction AI API Key is required' })
      .nonempty().parse,
  })
  textExtractionAiApiKey: string;
}
