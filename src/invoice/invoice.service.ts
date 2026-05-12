/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateInvoiceDto, QueryInvoiceDto } from './invoice.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import {
  ClaimStatus,
  InvoiceItemType,
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { DefaultArgs } from '@prisma/client/runtime/client';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import { AuthService } from '@thallesp/nestjs-better-auth';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly humanIdService: HumanIdService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}
  async create(
    createInvoiceDto: CreateInvoiceDto,
    query: CustomRepresentationQueryDto,
    options?: {
      prismaClient?: Omit<
        PrismaClient<never, undefined, DefaultArgs>,
        '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
      >;
      throwIfInvoiceExists?: boolean;
    },
  ) {
    const prismaClient = options?.prismaClient || this.prismaService;
    const invoice = await prismaClient.invoice.findUnique({
      where: { claimId: createInvoiceDto.claimId },
    });
    if (invoice) {
      if (options?.throwIfInvoiceExists) {
        throw new BadRequestException('Invoice already exists');
      } else {
        return invoice;
      }
    }

    const claim = await prismaClient.claim.findUnique({
      where: { id: createInvoiceDto.claimId, status: ClaimStatus.VERIFIED },
      include: {
        match: true,
        foundDocumentCase: {
          select: {
            case: {
              select: {
                document: {
                  select: {
                    type: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!claim) throw new BadRequestException('Claim not found');
    const finderReward =
      claim.foundDocumentCase.case.document?.type?.finderReward ??
      new Decimal(0);
    const serviceFee =
      claim.foundDocumentCase.case.document?.type?.serviceFee ?? new Decimal(0);
    const totalAmount = finderReward.plus(serviceFee);
    return await prismaClient.invoice.create({
      data: {
        claimId: createInvoiceDto.claimId,
        invoiceNumber: await this.humanIdService.generate({
          prefix: EntityPrefix.INVOICE,
        }),
        serviceFee,
        finderReward,
        totalAmount,
        balanceDue: totalAmount,
        items: {
          create: [
            {
              type: InvoiceItemType.SERVICE_FEE,
              label: 'Recovery Service Fee',
              amount: serviceFee,
            },
            {
              type: InvoiceItemType.FINDER_REWARD,
              label: 'Finder Reward',
              amount: finderReward,
            },
          ],
        },
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async addItem(
    invoiceId: string,
    item: {
      type: InvoiceItemType;
      label: string;
      description?: string;
      amount: Decimal;
    },
    prismaClient: Omit<
      PrismaClient<never, undefined, DefaultArgs>,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
    > = this.prismaService,
  ) {
    const invoice = await prismaClient.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    const newTotal = invoice.totalAmount.plus(item.amount);
    await prismaClient.invoiceItem.create({ data: { invoiceId, ...item } });
    await prismaClient.invoice.update({
      where: { id: invoiceId },
      data: {
        totalAmount: newTotal,
        balanceDue: newTotal.minus(invoice.amountPaid),
      },
    });
  }

  async findAll(
    query: QueryInvoiceDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { invoice: ['list-any'] } },
    });
    const dbQuery: Prisma.InvoiceWhereInput = {
      AND: [
        {
          claimId: query?.claimId,
          status: query?.status,
          invoiceNumber: query?.invoiceNumber,
          claim: {
            claimNumber: query?.claimNumber,
            userId: isAdmin ? query?.userId : user.id,
          },
        },
      ],
    };
    const totalCount = await this.prismaService.invoice.count({
      where: dbQuery,
    });

    const data = await this.prismaService.invoice.findMany({
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
      body: { userId: user.id, permission: { invoice: ['list-any'] } },
    });

    const data = await this.prismaService.invoice.findUnique({
      where: { id, claim: { userId: isAdmin ? undefined : user.id } },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Invoice not found');
    return data;
  }
}
