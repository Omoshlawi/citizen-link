import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Logger,
  Post,
} from '@nestjs/common';
import { DocaiConfig } from './docai.config';
import { DocaiCompletedResult, DocaiFailedResult } from './docai.dto';
import { DocaiWebhookDto } from './docai-webhook.schema';
import { DocaiWebhookService } from './docai-webhook.service';

@Controller('webhooks/docai')
export class DocaiWebhookController {
  private readonly logger = new Logger(DocaiWebhookController.name);

  constructor(
    private readonly config: DocaiConfig,
    private readonly webhookService: DocaiWebhookService,
  ) {}

  @Post('progress')
  async handleProgress(
    @Headers('x-internal-secret') secret: string,
    @Body() payload: DocaiWebhookDto,
  ): Promise<{ ok: boolean }> {
    if (secret !== this.config.callbackSecret) {
      throw new ForbiddenException('Invalid callback secret');
    }

    const { jobId, stage } = payload;
    this.logger.log(`Docai webhook received: stage=${stage} job=${jobId}`);

    if (stage === 'VISION') {
      await this.webhookService.handleVision(jobId);
    } else if (stage === 'COMPLETED') {
      await this.webhookService.handleCompleted(jobId, payload.result as DocaiCompletedResult);
    } else if (stage === 'FAILED') {
      await this.webhookService.handleFailed(jobId, payload.result as DocaiFailedResult);
    }

    return { ok: true };
  }
}
