import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Post,
  Put,
  Delete,
  Patch,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CreatCustomerDto,
  FindCustomerResponseDto,
  FindCustomersDto,
  GetCustomerResponseDto,
  UpdateCustomerDto,
} from './customer.dto';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../query-builder';
import { RequireSystemPermission } from '../auth/auth.decorators';
import { Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '../auth/auth.types';

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('/')
  @RequireSystemPermission({
    customer: ['list'],
  })
  @ApiOperation({ summary: 'Find customers' })
  @ApiOkResponse({ type: FindCustomerResponseDto })
  @ApiErrorsResponse()
  queryAmenity(
    @Query() query: FindCustomersDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.customerService.findCustomers(query, originalUrl);
  }

  @Get('/:id')
  @RequireSystemPermission({
    customer: ['list'],
  })
  @ApiOperation({ summary: 'Get customer by id' })
  @ApiOkResponse({ type: GetCustomerResponseDto })
  @ApiErrorsResponse()
  getCustomerById(
    @Param('id') id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.customerService.getById(id, query);
  }

  @Post('/')
  @RequireSystemPermission({
    customer: ['create'],
  })
  @ApiOperation({ summary: 'Create customer' })
  @ApiOkResponse({ type: GetCustomerResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  createCustomer(
    @Body() body: CreatCustomerDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() session: UserSession,
  ) {
    return this.customerService.create(body, query, session.user.id);
  }

  @Put('/:id')
  @RequireSystemPermission({
    customer: ['update'],
  })
  @ApiOperation({ summary: 'Update customer' })
  @ApiOkResponse({ type: GetCustomerResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  updateCustomer(
    @Param('id') id: string,
    @Body() body: UpdateCustomerDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.customerService.update(id, body, query);
  }

  @RequireSystemPermission({
    customer: ['delete'],
  })
  @Delete('/:id')
  @ApiOperation({ summary: 'Delete customer' })
  @ApiOkResponse({ type: GetCustomerResponseDto })
  @ApiErrorsResponse()
  deleteCustomer(@Param('id') id: string, @Query() query: DeleteQueryDto) {
    return this.customerService.delete(id, query);
  }

  @Patch('/:id/restore')
  @RequireSystemPermission({
    customer: ['restore'],
  })
  @ApiOperation({ summary: 'Restore customer' })
  @ApiOkResponse({ type: GetCustomerResponseDto })
  @ApiErrorsResponse()
  restoreCustomer(
    @Param('id') id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.customerService.restore(id, query);
  }
}
