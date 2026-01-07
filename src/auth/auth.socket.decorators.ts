/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';
import { UserSession } from './auth.types';
import { WsException } from '@nestjs/websockets';

type WsSessionOptions = {
  requireSession?: boolean;
};

export const WsSession = createParamDecorator(
  (
    data: WsSessionOptions = { requireSession: false },
    ctx: ExecutionContext,
  ) => {
    const connectedSocket = ctx.switchToWs().getClient<Socket>();
    const session: UserSession | undefined = connectedSocket.data.session;
    if (data.requireSession && !session?.session && !session?.user)
      throw new WsException('UnAuthorized');
    return session;
  },
);
