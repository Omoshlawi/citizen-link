import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { DocaiConfig } from './docai.config';
import {
  DocaiEmbedRequest,
  DocaiEmbedResponse,
  DocaiExtractionRequest,
  DocaiProcessResponse,
} from './docai.dto';

export interface SubmitExtractionParams {
  caseNumber: string;
  /** Pre-signed download URLs for the document images, in page order */
  imageUrls: string[];
  /** URL docai will POST event-based webhooks to (extraction.*.success / *.failed) */
  webhookUrl: string;
  /** 1 (highest) – 10 (lowest). Omit to use the default (5). */
  priority?: number;
}

@Injectable()
export class DocaiService {
  private readonly logger = new Logger(DocaiService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: DocaiConfig,
  ) {}

  /**
   * Submit a document extraction job to citizen-link-docai.
   *
   * Returns the docai job_id — caller saves this on AIExtraction.docaiJobId
   * so incoming webhooks (which carry only jobId) can be looked up.
   */
  async submitJob(params: SubmitExtractionParams): Promise<string> {
    const body: DocaiExtractionRequest = {
      case_number: params.caseNumber,
      image_urls: params.imageUrls,
      webhook_url: params.webhookUrl,
      ...(params.priority !== undefined && { priority: params.priority }),
    };

    const response = await firstValueFrom(
      this.http.post<DocaiProcessResponse>('/v1/jobs/extraction', body),
    );

    this.logger.debug(
      `Submitted case ${params.caseNumber} to docai: job=${response.data.job_id}`,
    );
    return response.data.job_id;
  }

  /**
   * Generate an embedding vector via citizen-link-docai.
   *
   * Returns the vector and its dimensionality — caller uses `dims` to pick
   * the correct DB column (embedding_768 or embedding_1536).
   */
  async embed(
    text: string,
    useCase: 'document' | 'search' = 'document',
  ): Promise<DocaiEmbedResponse> {
    const body: DocaiEmbedRequest = { text, use_case: useCase };
    const response = await firstValueFrom(
      this.http.post<DocaiEmbedResponse>('/v1/embed', body),
    );
    this.logger.debug(
      `Embedding generated: dims=${response.data.dims} model=${response.data.model}`,
    );
    return response.data;
  }
}
