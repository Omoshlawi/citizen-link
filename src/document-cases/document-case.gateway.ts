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
import { DocumentCase } from '../../generated/prisma/client';
import { WsSession } from '../auth/auth.socket.decorators';
import { WsAuthGuard } from '../auth/auth.socket.guards';
import { UserSession } from '../auth/auth.types';
import { WsCreateFoundDocumentCaseDto } from './document-cases.dto';
import { DocumentCasesService } from './document-cases.service';

@WebSocketGateway({ namespace: 'extraction' })
@UseGuards(WsAuthGuard)
export class DocumentCaseGateway {
  private readonly logger = new Logger(DocumentCaseGateway.name);
  constructor(private readonly documentCaseService: DocumentCasesService) {}
  @WebSocketServer()
  private namespace: Namespace;

  @SubscribeMessage('extract')
  async handleExtraction(
    @WsSession({ requireSession: true }) session: UserSession,
    @Ack()
    ack: (extraction: DocumentCase) => void,
    @MessageBody() payload: WsCreateFoundDocumentCaseDto,
  ) {
    try {
      const { caseType, ...caseData } = payload;
      let docCase: DocumentCase;
      if (caseType === 'FOUND') {
        docCase = await this.documentCaseService.reportFoundDocumentCase(
          caseData,
          {},
          session.user,
        );
      } else {
        docCase = await this.documentCaseService.reportLostDocumentCaseScanned(
          caseData,
          {},
          session.user,
        );
      }
      ack(docCase);
    } catch (error) {
      this.logger.error(
        'Error creating document case via websocket',
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
