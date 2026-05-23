import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { DocaiConfig } from './docai.config';
import {
  DocaiEmbedRequest,
  DocaiEmbedResponse,
  DocaiExtractionRequest,
  DocaiProcessResponse,
  SubmitExtractionParams,
} from './docai.dto';
import {
  DocaiConversationListDto,
  DocaiJobListDto,
  DocaiJobStagesDto,
  DocaiJobStatusDto,
  DocaiStageDetailDto,
  DocaiStageListDto,
  DocaiWebhookDeliveryDto,
  DocaiWebhookDeliveryListDto,
  GetDocaiJobStagesDto,
  GetDocaiStageDto,
  ListDocaiConversationsDto,
  ListDocaiJobsDto,
  ListDocaiStagesDto,
  ListDocaiWebhooksDto,
} from './docai-admin.dto';
import { UserSession } from '../auth/auth.types';

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
  async submitJob(
    params: SubmitExtractionParams,
    user: UserSession['user'],
  ): Promise<string> {
    const imageUrls = params.imageUrls.map((url) =>
      url.replaceAll('localhost', 'host.docker.internal'),
    );
    const body: DocaiExtractionRequest = {
      case_number: params.caseNumber,
      image_urls: imageUrls,
      webhook_url: params.webhookUrl,
      ...(params.priority !== undefined && { priority: params.priority }),
    };

    this.logger.debug(
      `Submitting docai job for case ${params.caseNumber} with request body: ${JSON.stringify(body)}`,
    );

    const response = await firstValueFrom(
      this.http.post<DocaiProcessResponse>('/v1/jobs/extraction', body, {
        headers: { 'X-User-Id': user.id }, // Pass user ID for auditing/logging in docai service
      }),
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

  get webhookUrl() {
    return this.config.webhookUrl;
  }

  async listJobs(
    dto: ListDocaiJobsDto,
    userId: string,
  ): Promise<DocaiJobListDto> {
    const response = await firstValueFrom(
      this.http.get<DocaiJobListDto>('/v1/jobs', {
        params: dto,
        headers: { 'X-User-Id': userId },
      }),
    );
    return response.data;
  }

  async getJob(id: string, userId: string): Promise<DocaiJobStatusDto> {
    const response = await firstValueFrom(
      this.http.get<DocaiJobStatusDto>(`/v1/jobs/${id}`, {
        headers: { 'X-User-Id': userId },
      }),
    );
    return response.data;
  }

  async listStages(
    dto: ListDocaiStagesDto,
    userId: string,
  ): Promise<DocaiStageListDto> {
    const response = await firstValueFrom(
      this.http.get<DocaiStageListDto>('/v1/stages', {
        params: dto,
        headers: { 'X-User-Id': userId },
      }),
    );
    return response.data;
  }

  async getStage(
    id: string,
    dto: GetDocaiStageDto,
    userId: string,
  ): Promise<DocaiStageDetailDto> {
    const response = await firstValueFrom(
      this.http.get<DocaiStageDetailDto>(`/v1/stages/${id}`, {
        params: dto as Record<string, unknown>,
        headers: { 'X-User-Id': userId },
      }),
    );
    return response.data;
  }

  async getJobStages(
    jobId: string,
    dto: GetDocaiJobStagesDto,
    userId: string,
  ): Promise<DocaiJobStagesDto> {
    const response = await firstValueFrom(
      this.http.get<DocaiJobStagesDto>(`/v1/jobs/${jobId}/stages`, {
        params: dto as Record<string, unknown>,
        headers: { 'X-User-Id': userId },
      }),
    );
    return response.data;
  }

  async listConversations(
    dto: ListDocaiConversationsDto,
    userId: string,
  ): Promise<DocaiConversationListDto> {
    const response = await firstValueFrom(
      this.http.get<DocaiConversationListDto>('/v1/conversations', {
        params: dto,
        headers: { 'X-User-Id': userId },
      }),
    );
    return response.data;
  }

  async listStageConversations(
    stageId: string,
    userId: string,
  ): Promise<DocaiConversationListDto> {
    const response = await firstValueFrom(
      this.http.get<DocaiConversationListDto>(
        `/v1/stages/${stageId}/conversations`,
        { headers: { 'X-User-Id': userId } },
      ),
    );
    return response.data;
  }

  async listWebhooks(
    dto: ListDocaiWebhooksDto,
    userId: string,
  ): Promise<DocaiWebhookDeliveryListDto> {
    const response = await firstValueFrom(
      this.http.get<DocaiWebhookDeliveryListDto>('/v1/webhooks', {
        params: dto as Record<string, unknown>,
        headers: { 'X-User-Id': userId },
      }),
    );
    return response.data;
  }

  async getWebhook(
    id: string,
    userId: string,
  ): Promise<DocaiWebhookDeliveryDto> {
    const response = await firstValueFrom(
      this.http.get<DocaiWebhookDeliveryDto>(`/v1/webhooks/${id}`, {
        headers: { 'X-User-Id': userId },
      }),
    );
    return response.data;
  }
}
