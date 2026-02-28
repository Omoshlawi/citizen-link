/* eslint-disable @typescript-eslint/unbound-method */
import z from 'zod';
import { Configuration, Value } from '@itgorillaz/configify';
import { ChatModel } from 'openai/resources/chat/chat';

@Configuration()
export class AiConfig {
  @Value('OPENAI_API_KEY', { parse: z.string().nonempty().parse })
  openaiApiKey: string;

  @Value('AI_BASE_URL', { parse: z.url().optional().parse })
  aiBaseUrl?: string;

  @Value('AI_MODEL', {
    parse: z.string().optional().parse,
    default: 'deepseek-chat',
  })
  aiModel: ChatModel;
  @Value('VISION_AI_MODEL', {
    parse: z.string().optional().parse,
    default: 'gemma3:4b',
    // default: 'maternion/LightOnOCR-2:1b',
    // default: 'qwen3-vl:8b',
    // default: 'llama3.2-vision:latest',
  })
  visionAiModel: ChatModel;
  @Value('VISION_AI_BASE_URL', {
    parse: z.url().optional().parse,
  })
  visionAiBaseUrl: string;
  @Value('VISION_API_KEY', { parse: z.string().nonempty().parse })
  visionAiApiKey: string;
  @Value('TEXT_EXTRACTION_AI_MODEL', {
    parse: z.string().optional().parse,
    default: 'gemma3:4b',
  })
  textExtractionAiModel: ChatModel;
  @Value('TEXT_EXTRACTION_AI_BASE_URL', {
    parse: z.url().optional().parse,
  })
  textExtractionAiBaseUrl?: string;
  @Value('TEXT_EXTRACTION_API_KEY', { parse: z.string().nonempty().parse })
  textExtractionAiApiKey: string;
}
