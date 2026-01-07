/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Namespace } from 'socket.io';
import { CreateFoundDocumentCaseDto } from './document-cases.dto';
import { BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { DocumentCasesService } from './document-cases.service';
import { WsAuthGuard } from '../auth/auth.socket.guards';
import { WsSession } from '../auth/auth.socket.decorators';
import { UserSession } from '../auth/auth.types';

@WebSocketGateway({ namespace: 'documents/cases' })
@UseGuards(WsAuthGuard)
export class DocumentCaseGateway {
  private readonly logger = new Logger(DocumentCaseGateway.name);
  constructor(private readonly documentCaseService: DocumentCasesService) {}
  @WebSocketServer()
  private namespace: Namespace;
  publishEvent(event: string, ...args: Array<any>) {
    return this.namespace.emit(event, ...args);
  }

  @SubscribeMessage('found')
  async createFoundDocumentCase(
    @MessageBody()
    payload: CreateFoundDocumentCaseDto,
    @WsSession({ requireSession: true }) session: UserSession,
  ) {
    try {
      if (!payload) {
        throw new WsException('Missing document case data');
      }
      const result = await this.documentCaseService.reportFoundDocumentCase(
        payload,
        {},
        session.user.id,
        this.publishEvent.bind(this),
      );

      return result;
    } catch (error) {
      this.logger.error(
        'Error creating found document case via websocket',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof WsException) {
        throw error;
      }

      if (error instanceof BadRequestException) {
        throw new WsException(error.message);
      }

      throw new WsException('Internal server error');
    }
  }
}
