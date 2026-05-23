import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { RequireSystemPermission } from '../auth/auth.decorators';
import { UserSession } from '../auth/auth.types';
import {
  GetDocaiJobStagesDto,
  GetDocaiStageDto,
  ListDocaiConversationsDto,
  ListDocaiJobsDto,
  ListDocaiStagesDto,
  ListDocaiWebhooksDto,
} from './docai-admin.dto';
import { DocaiService } from './docai.service';

@ApiTags('DocAI Admin')
@Controller('docai')
export class DocaiAdminController {
  constructor(private readonly docai: DocaiService) {}

  // ── Jobs ──────────────────────────────────────────────────────────────────

  @Get('jobs')
  @ApiOperation({ summary: 'List all DocAI pipeline jobs' })
  @RequireSystemPermission({ docai: ['view-jobs'] })
  listJobs(@Query() dto: ListDocaiJobsDto, @Session() { user }: UserSession) {
    return this.docai.listJobs(dto, user.id);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get a single DocAI job by ID' })
  @RequireSystemPermission({ docai: ['view-jobs'] })
  getJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() { user }: UserSession,
  ) {
    return this.docai.getJob(id, user.id);
  }

  @Get('jobs/:id/stages')
  @ApiOperation({ summary: 'Get all processing stages for a job' })
  @RequireSystemPermission({ docai: ['view-stages'] })
  getJobStages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: GetDocaiJobStagesDto,
    @Session() { user }: UserSession,
  ) {
    return this.docai.getJobStages(id, dto, user.id);
  }

  // ── Stages ────────────────────────────────────────────────────────────────

  @Get('stages')
  @ApiOperation({ summary: 'List DocAI processing stages' })
  @RequireSystemPermission({ docai: ['view-stages'] })
  listStages(
    @Query() dto: ListDocaiStagesDto,
    @Session() { user }: UserSession,
  ) {
    return this.docai.listStages(dto, user.id);
  }

  @Get('stages/:id')
  @ApiOperation({ summary: 'Get a single DocAI stage by ID' })
  @RequireSystemPermission({ docai: ['view-stages'] })
  getStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: GetDocaiStageDto,
    @Session() { user }: UserSession,
  ) {
    return this.docai.getStage(id, dto, user.id);
  }

  @Get('stages/:id/conversations')
  @ApiOperation({ summary: 'Get all LLM correction rounds for a stage' })
  @RequireSystemPermission({ docai: ['view-conversations'] })
  listStageConversations(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() { user }: UserSession,
  ) {
    return this.docai.listStageConversations(id, user.id);
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  @Get('conversations')
  @ApiOperation({ summary: 'List all DocAI LLM correction rounds' })
  @RequireSystemPermission({ docai: ['view-conversations'] })
  listConversations(
    @Query() dto: ListDocaiConversationsDto,
    @Session() { user }: UserSession,
  ) {
    return this.docai.listConversations(dto, user.id);
  }

  // ── Webhook deliveries ────────────────────────────────────────────────────

  @Get('webhooks')
  @ApiOperation({ summary: 'List DocAI webhook delivery attempts' })
  @RequireSystemPermission({ docai: ['view-webhooks'] })
  listWebhooks(
    @Query() dto: ListDocaiWebhooksDto,
    @Session() { user }: UserSession,
  ) {
    return this.docai.listWebhooks(dto, user.id);
  }

  @Get('webhooks/:id')
  @ApiOperation({ summary: 'Get a single DocAI webhook delivery by ID' })
  @RequireSystemPermission({ docai: ['view-webhooks'] })
  getWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() { user }: UserSession,
  ) {
    return this.docai.getWebhook(id, user.id);
  }
}
