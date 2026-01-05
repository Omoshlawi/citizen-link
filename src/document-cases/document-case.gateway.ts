/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace } from 'socket.io';

@WebSocketGateway({ namespace: 'documents/cases' })
export class DocumentCaseGateway {
  @WebSocketServer()
  private namespace: Namespace;
  publishEvent(event: string, ...args: Array<any>) {
    return this.namespace.emit(event, ...args);
  }
  publishFoundCaseStatus(
    status:
      | 'validate-images'
      | 'analyse-images'
      | 'extract-data'
      | 'extract-security-questions'
      | 'confidence-score',
  ) {
    return this.publishEvent('create-found-case-status', status);
  }
}
