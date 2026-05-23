import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Logger,
  Post,
} from '@nestjs/common';
import { DocaiConfig } from './docai.config';
import { DocaiExtractionSuccessResult, DocaiStageFailed } from './docai.dto';
import { DocaiEvent, DocaiWebhookDto } from './docai-webhook.schema';
import { DocaiWebhookService } from './docai-webhook.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@AllowAnonymous()
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

    const { jobId, event } = payload;
    this.logger.log(`Docai webhook: event=${event} job=${jobId}`);

    switch (event) {
      case DocaiEvent.EXTRACTION_VISION_SUCCESS:
        await this.webhookService.handleVisionSuccess(jobId);
        break;

      case DocaiEvent.EXTRACTION_STRUCTURE_SUCCESS:
        await this.webhookService.handleStructureSuccess(jobId);
        break;

      case DocaiEvent.EXTRACTION_SUCCESS:
        await this.webhookService.handleExtractionSuccess(
          jobId,
          payload.result as unknown as DocaiExtractionSuccessResult,
        );
        break;

      case DocaiEvent.EXTRACTION_VISION_FAILED:
      case DocaiEvent.EXTRACTION_STRUCTURE_FAILED:
        await this.webhookService.handleStageFailed(
          jobId,
          event,
          payload.result as unknown as DocaiStageFailed,
        );
        break;

      case DocaiEvent.EXTRACTION_FAILED:
        this.logger.log(
          'Received terminal extraction failure event - Doing nothing as stage-specific failure event already handled it',
          payload,
        );
        // Rollup event — NestJS already acted on the stage-specific event above.
        // No further action needed; acknowledged so ARQ does not retry.
        break;
    }

    return { ok: true };
  }
}
