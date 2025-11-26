/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../query-builder';
import { RequireSystemPermission } from '../auth/auth.decorators';
import {
  CreateAddressLocaleDto,
  GetAddressLocaleResponseDto,
  QueryAddressLocaleDto,
  QueryAddressLocaleResponseDto,
  UpdateAddressLocaleDto,
} from './address-locales.dto';
import { AddressLocalesService } from './address-locales.service';

@Controller('address-locales')
export class AddressLocalesController {
  constructor(private readonly service: AddressLocalesService) {}

  @Post()
  @RequireSystemPermission({ addressLocale: ['create'] })
  @ApiOperation({ summary: 'Create an address locale template' })
  @ApiOkResponse({ type: GetAddressLocaleResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  create(
    @Body() dto: CreateAddressLocaleDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.create(dto, query);
  }

  @Get()
  @ApiOperation({ summary: 'Query address locale templates' })
  @ApiOkResponse({ type: QueryAddressLocaleResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryAddressLocaleDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.service.findAll(query, originalUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get address locale template' })
  @ApiOkResponse({ type: GetAddressLocaleResponseDto })
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.findOne(id, query);
  }

  @Patch(':id')
  @RequireSystemPermission({ addressLocale: ['update'] })
  @ApiOperation({ summary: 'Update address locale template' })
  @ApiOkResponse({ type: GetAddressLocaleResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressLocaleDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.update(id, dto, query);
  }

  @Delete(':id')
  @RequireSystemPermission({ addressLocale: ['delete'] })
  @ApiOperation({ summary: 'Soft-delete address locale template' })
  @ApiOkResponse({ type: GetAddressLocaleResponseDto })
  @ApiErrorsResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
  ) {
    return this.service.remove(id, query);
  }

  @Post(':id/restore')
  @RequireSystemPermission({ addressLocale: ['restore'] })
  @ApiOperation({ summary: 'Restore address locale template' })
  @ApiOkResponse({ type: GetAddressLocaleResponseDto })
  @ApiErrorsResponse()
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.restore(id, query);
  }
}
