import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  ParseUUIDPipe,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { AddressService } from './address.service';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CreateAddressDto,
  GetAddressResponseDto,
  QueryAddressDto,
  QueryAddressResponseDto,
  UpdateAddressDto,
} from './address.dto';
import { Session } from '@thallesp/nestjs-better-auth';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../query-builder';
import { UserSession } from '../auth/auth.types';

@Controller('address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get('/')
  @ApiOperation({ summary: 'Query Address' })
  @ApiOkResponse({ type: QueryAddressResponseDto })
  @ApiErrorsResponse()
  queryAddress(
    @Query() query: QueryAddressDto,
    @Session() { user }: UserSession,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.addressService.getAll(query, originalUrl, user.id);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get Address' })
  @ApiOkResponse({ type: GetAddressResponseDto })
  @ApiErrorsResponse()
  getAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.addressService.getById(id, query, user.id);
  }
  @Post('/')
  @ApiOperation({ summary: 'Create Address' })
  @ApiCreatedResponse({ type: GetAddressResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  createAddress(
    @Body() createAddressDto: CreateAddressDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.addressService.create(createAddressDto, user.id, query);
  }
  @Patch('/:id')
  @ApiOperation({ summary: 'Update Address' })
  @ApiOkResponse({ type: GetAddressResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  updateAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAddressDto: UpdateAddressDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.addressService.update(id, updateAddressDto, query, user.id);
  }
  @Delete('/:id')
  @ApiOperation({ summary: 'Delete Address' })
  @ApiOkResponse({ type: GetAddressResponseDto })
  @ApiErrorsResponse()
  deleteAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.addressService.delete(id, query, user.id);
  }
  @Post('/:id/restore')
  @ApiOperation({ summary: 'Restore Address' })
  @ApiOkResponse({ type: GetAddressResponseDto })
  @ApiErrorsResponse()
  restoreAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.addressService.restore(id, query, user.id);
  }
}
