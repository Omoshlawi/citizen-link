/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { HttpException, Logger, UseGuards } from '@nestjs/common';
import {
  Ack,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Namespace } from 'socket.io';
import {
  AIExtraction,
  AIExtractionInteraction,
  DocumentCase,
} from '../../generated/prisma/browser';
import { WsSession } from '../auth/auth.socket.decorators';
import { WsAuthGuard } from '../auth/auth.socket.guards';
import { UserSession } from '../auth/auth.types';
import { WsCreateFoundDocumentCaseDto } from './document-cases.dto';
import { ExtractionService } from '../extraction/extraction.service';
import { DocumentCasesService } from './document-cases.service';
import { ProgressEvent } from '../extraction/extraction.interface';

@WebSocketGateway({ namespace: 'extraction' })
@UseGuards(WsAuthGuard)
export class DocumentCaseGateway {
  private readonly logger = new Logger(DocumentCaseGateway.name);
  constructor(
    private readonly extractionService: ExtractionService,
    private readonly documentCaseService: DocumentCasesService,
  ) {}
  @WebSocketServer()
  private namespace: Namespace;

  publishEvent(event: string, ...args: Array<any>) {
    return this.namespace.emit(event, ...args);
  }

  private publishProgressEvent(extrationId: string, payload: ProgressEvent) {
    return this.publishEvent(`stream_progress:${extrationId}`, payload);
  }

  @SubscribeMessage('start')
  async handleStartExtraction(
    @WsSession({ requireSession: true }) _session: UserSession,
    @Ack()
    ack: (
      extraction: AIExtraction & {
        aiextractionInteractions: Array<AIExtractionInteraction>;
      },
    ) => void,
  ) {
    try {
      const extraction = await this.extractionService.getOrCreateAiExtraction();
      return ack(extraction);
    } catch (error) {
      this.logger.error(
        'Error initiating extraction via websocket',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof WsException) {
        throw error;
      }

      if (error instanceof HttpException) {
        throw new WsException(error.message);
      }

      throw new WsException('Internal server error');
    }
  }
  @SubscribeMessage('extract')
  async handleExtraction(
    @WsSession({ requireSession: true }) session: UserSession,
    @Ack()
    ack: (extraction: DocumentCase) => void,
    @MessageBody() payload: WsCreateFoundDocumentCaseDto,
  ) {
    try {
      const { extractionId, caseType, ...caseData } = payload;
      let docCase: DocumentCase;
      if (caseType === 'FOUND') {
        docCase = await this.documentCaseService.reportFoundDocumentCase(
          extractionId,
          caseData,
          {},
          session.user.id,
          (data) => this.publishProgressEvent(extractionId, data),
        );
      } else {
        docCase = await this.documentCaseService.reportLostDocumentCaseScanned(
          extractionId,
          caseData,
          {},
          session.user.id,
          (data) => this.publishProgressEvent(extractionId, data),
        );
      }
      ack(docCase);
    } catch (error) {
      this.logger.error(
        'Error creating found document case via websocket',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof WsException) {
        throw error;
      }

      if (error instanceof HttpException) {
        throw new WsException(error.message);
      }

      throw new WsException('Internal server error');
    }
  }
}
