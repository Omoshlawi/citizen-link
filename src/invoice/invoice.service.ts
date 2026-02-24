import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateInvoiceDto, QueryInvoiceDto } from './invoice.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import { PrismaClient } from '../../generated/prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/client';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { pick } from 'lodash';
import { UserSession } from '../auth/auth.types';
import { isSuperUser } from 'src/app.utils';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly humanIdService: HumanIdService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
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
      where: { id: createInvoiceDto.claimId },
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
      claim.foundDocumentCase.case.document?.type?.finderReward?.toNumber() ??
      0.0;
    const serviceFee =
      claim.foundDocumentCase.case.document?.type?.serviceFee?.toNumber() ??
      0.0;
    const totalAmount = finderReward + serviceFee;
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
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async findAll(
    query: QueryInvoiceDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.invoice.findMany
    > = {
      where: {
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
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.invoice.findMany(dbQuery),
      this.prismaService.invoice.count(pick(dbQuery, 'where')),
    ]);
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
    const isAdmin = isSuperUser(user);

    const data = await this.prismaService.invoice.findUnique({
      where: { id, claim: { userId: isAdmin ? undefined : user.id } },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Invoice not found');
    return data;
  }
}
