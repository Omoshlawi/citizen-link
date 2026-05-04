import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { Request } from 'express';
import {
  ActiveStationMode,
  RequireActiveStation,
  RequireSystemPermission,
} from './auth.decorators';
import { BetterAuthWithPlugins, UserSession } from './auth.types';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RequireSystemPermissionsGuard implements CanActivate {
  private logger = new Logger(RequireSystemPermissionsGuard.name);
  constructor(
    private readonly authService: AuthService<BetterAuthWithPlugins>,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.get(
      RequireSystemPermission,
      context.getHandler(),
    );
    if (!permissions || Object.keys(permissions).length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const session = (await this.authService.api.getSession({
      headers: fromNodeHeaders(request.headers),
    })) as UserSession | null;
    if (!session?.user) {
      this.logger.warn(
        `Access denied. Missing user for session ${session?.session.id}`,
      );
      throw new UnauthorizedException(
        'Access denied. You must be logged in to access this resource',
      );
    }
    const { success } = await this.authService.api.userHasPermission({
      headers: fromNodeHeaders(request.headers),
      body: {
        permissions,
      },
    });
    if (!success) {
      this.logger.warn(
        `Access denied. Missing permissions: ${JSON.stringify(permissions)}`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
    return true;
  }
}

@Injectable()
export class RequireActiveStationGuard implements CanActivate {
  private logger = new Logger(RequireActiveStationGuard.name);
  constructor(
    private readonly authService: AuthService<BetterAuthWithPlugins>,
    private reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const mode = this.reflector.get(RequireActiveStation, context.getHandler());
    const request = context.switchToHttp().getRequest<Request>();
    const session = (await this.authService.api.getSession({
      headers: fromNodeHeaders(request.headers),
    })) as UserSession | null;
    if (!session?.user) {
      this.logger.warn(
        `Access denied. Missing user for session ${session?.session.id}`,
      );
      throw new UnauthorizedException(
        'Access denied. You must be logged in to access this resource',
      );
    }
    // if mode is required - ensure user has active station
    if (mode === ActiveStationMode.REQUIRED) {
      if (!session?.session?.stationId) {
        this.logger.warn(
          `Access denied. Missing active station for user ${session.user.id}`,
        );
        throw new ForbiddenException(
          'You do not have an active station. Please select an active station to access this resource',
        );
      }
      // If the station id is not available  throw an exception
      const station = await this.prisma.pickupStation.findUnique({
        where: {
          id: session.session.stationId,
          voided: false,
        },
      });
      if (!station) {
        this.logger.warn(
          `Station ${session.session.stationId} is not active or not found for user ${session.user.id}`,
        );
        throw new ForbiddenException(
          'Your active station is not active or not found. Please select an active station to access this resource',
        );
      }
      // If not assigned to the user, throw an exception
      const userStation = await this.prisma.staffStationOperation.findFirst({
        where: {
          userId: session.user.id,
          stationId: session.session.stationId,
          voided: false,
        },
      });
      if (!userStation) {
        this.logger.warn(
          `User ${session.user.id} is not assigned to station ${session.session.stationId} for any operations`,
        );
        throw new ForbiddenException(
          'You are not assigned to this station. Please select an active station to access this resource',
        );
      }
    } else if (mode === ActiveStationMode.FORBIDDEN) {
      if (session?.session?.stationId) {
        this.logger.warn(
          `Access denied. User ${session.user.id} has an active station`,
        );
        throw new ForbiddenException(
          'You have an active station. You cannot access this resource',
        );
      }
    }
    //
    return true;
  }
}
