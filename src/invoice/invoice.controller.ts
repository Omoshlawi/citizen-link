import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import { QueryInvoiceDto } from './invoice.dto';
import { InvoiceService } from './invoice.service';

@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @ApiOperation({ summary: 'Query invoices' })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryInvoiceDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.invoiceService.findAll(query, originalUrl, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiOkResponse()
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.invoiceService.findOne(id, query, user);
  }
}
