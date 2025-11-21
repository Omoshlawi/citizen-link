import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../query-builder';
import {
  CreatCustomerDto,
  CustomerSelfRegistrationDto,
  FindCustomersDto,
  UpdateCustomerDto,
} from './customer.dto';
import { pick } from 'lodash';
import { Customer, CustomerGender } from '../../generated/prisma/browser';
import dayjs from 'dayjs';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { BetterAuthWithPlugins } from '../auth/auth.types';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sortService: SortService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private authService: AuthService<BetterAuthWithPlugins>,
  ) {}

  async findCustomers(findCustomersDto: FindCustomersDto, originalUrl: string) {
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.customer.findMany
    > = {
      where: {
        AND: [
          { voided: findCustomersDto?.includeVoided ? undefined : false },
          {
            OR: findCustomersDto.search
              ? [{ name: { contains: findCustomersDto.search } }]
              : undefined,
          },
        ],
      },
      ...this.paginationService.buildPaginationQuery(findCustomersDto),
      ...this.representationService.buildCustomRepresentationQuery(
        findCustomersDto?.v,
      ),
      ...this.sortService.buildSortQuery(findCustomersDto?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.customer.findMany(dbQuery),
      this.prismaService.customer.count(pick(dbQuery, 'where')),
    ]);

    return {
      results: data,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        findCustomersDto,
      ),
    };
  }

  async getById(id: string, query: CustomRepresentationQueryDto) {
    const data = await this.prismaService.customer.findUnique({
      where: {
        id,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });

    if (!data) {
      throw new NotFoundException('Customer not found');
    }
    return data;
  }

  async create(
    data: CreatCustomerDto,
    query: CustomRepresentationQueryDto,
    createdById: string,
  ) {
    const _data = await this.prismaService.customer.create({
      data: {
        address: data.address!,
        dateOfBirth: dayjs(data.dateOfBirth).toDate(),
        email: data.email!,
        gender: data.gender as CustomerGender,
        identificationNumber: data.identificationNumber!,
        name: data.name,
        phonenNumber: data.phonenNumber!,
        createdById,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });

    return _data;
  }

  async update(
    id: string,
    data: UpdateCustomerDto,
    query: CustomRepresentationQueryDto,
  ) {
    const _data = await this.prismaService.customer.update({
      where: { id },
      data: {
        address: data.address ?? undefined,
        dateOfBirth: data.dateOfBirth
          ? dayjs(data.dateOfBirth).toDate()
          : undefined,
        email: data.email ?? undefined,
        gender: data.gender as CustomerGender,
        identificationNumber: data.identificationNumber ?? undefined,
        name: data.name,
        phonenNumber: data.phonenNumber ?? undefined,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });

    return _data;
  }
  async delete(id: string, query: DeleteQueryDto) {
    const { purge, v } = query;
    let data: Customer;
    if (purge) {
      data = await this.prismaService.customer.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(v),
      });
    } else {
      data = await this.prismaService.customer.update({
        where: { id },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(v),
      });
    }
    return data;
  }

  async restore(id: string, query: CustomRepresentationQueryDto) {
    const data = await this.prismaService.customer.update({
      where: { id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }

  async selfRegister(data: CustomerSelfRegistrationDto) {
    // Check if email is available
    const userWithEmail = await this.prismaService.user.findFirst({
      where: {
        email: data.email!,
      },
    });
    if (userWithEmail) {
      throw new BadRequestException('Email is already in use');
    }
    const user = await this.authService.api.createUser({
      body: {
        email: data.email!,
        name: data.name,
        password: data.password,
        role: 'user',
      },
    });
    const customer = await this.prismaService.customer.create({
      data: {
        address: data.address!,
        dateOfBirth: dayjs(data.dateOfBirth).toDate(),
        email: data.email!,
        gender: data.gender as CustomerGender,
        identificationNumber: data.identificationNumber!,
        name: data.name,
        phonenNumber: data.phonenNumber!,
        userId: user.user.id,
      },
    });
    return customer;
  }
}
