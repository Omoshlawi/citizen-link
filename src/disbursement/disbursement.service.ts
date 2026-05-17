import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { parseDate } from '../app.utils';
import { B2CCallbackBodyDto } from '../daraja/daraja.dto';
import { QueryDisbursementDto } from './disbursement.dto';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class DisbursementService {
  private readonly logger = new Logger(DisbursementService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly walletService: WalletService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}

  /**
   * Daraja B2C result callback — dispatches to WalletWithdrawal handler.
   */
  async handleB2CCallback(body: B2CCallbackBodyDto) {
    const handled = await this.walletService.handleWithdrawalCallback(body);
    if (!handled) {
      this.logger.warn(
        `B2C callback for unknown ConversationID: ${body.Result.ConversationID}`,
      );
    }
  }

  async findAll(
    query: QueryDisbursementDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { disbursement: ['list-any'] } },
    });
    const dbQuery: Prisma.DisbursementWhereInput = {
      AND: [
        {
          recipientId: isAdmin ? query.recipientId : user.id,
          createdAt: {
            gte: parseDate(query.createdAtFrom),
            lte: parseDate(query.createdAtTo),
          },
        },
      ],
    };

    const totalCount = await this.prismaService.disbursement.count({
      where: dbQuery,
    });

    const data = await this.prismaService.disbursement.findMany({
      where: dbQuery,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    });

    return {
      results: data,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  async findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { disbursement: ['view-any'] } },
    });
    const disbursement = await this.prismaService.disbursement.findUnique({
      where: { id, recipientId: isAdmin ? undefined : user.id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!disbursement) throw new NotFoundException('Disbursement not found');
    return disbursement;
  }
}
