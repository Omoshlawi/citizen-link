/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CanActivate, ExecutionContext, Inject, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { Socket } from 'socket.io';
import { BetterAuthWithPlugins, UserSession } from './auth.types';
import { fromNodeHeaders } from 'better-auth/node';

export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'ws') {
      return false;
    }

    const socket = context.switchToWs().getClient<Socket>();
    const isValid = await this.validateToken(socket);
    if (!isValid) {
      throw new WsException('Unauthorized');
    }

    return true;
  }

  async validateToken(socket: Socket): Promise<boolean> {
    const headerToken = socket.handshake.headers.authorization;
    const authToken = socket.handshake.auth.token;

    // Attempt to retrieve session from provided token (either in header or handshake.auth)
    let session: UserSession | null = null;
    try {
      // Use fromNodeHeaders to convert handshake.headers to standard format for Better Auth
      session = (await this.authService.api.getSession({
        headers: fromNodeHeaders({
          ...socket.handshake.headers,
          authorization:
            headerToken ?? (authToken ? `Bearer ${authToken}` : undefined),
        }),
      })) as any;
    } catch (err: any) {
      this.logger.warn('Error validating token: ' + err.message);
      return false;
    }

    if (session && session?.session && session?.user) {
      socket.data.session = session;
      return true;
    }
    return false;
  }
}
