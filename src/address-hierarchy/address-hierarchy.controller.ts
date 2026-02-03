import {
  Controller,
  Get,
  Query,
  Param,
  Delete,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { AddressHierarchyService } from './address-hierarchy.service';
import { ApiErrorsResponse } from '../app.decorators';
import {
  GetAddressHierarchyResponseDto,
  QueryAddressHierarchyDto,
  QueryAddressHierarchyResponseDto,
} from './address-hierarchy.dto';
import { OptionalAuth } from '@thallesp/nestjs-better-auth';
import { ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../common/query-builder';

@Controller('address-hierarchy')
export class AddressHierarchyController {
  constructor(
    private readonly addressHierarchyService: AddressHierarchyService,
  ) {}

  @Get('/')
  @OptionalAuth()
  @ApiOperation({ summary: 'Query AddressHierarchy' })
  @ApiOkResponse({ type: QueryAddressHierarchyResponseDto })
  @ApiErrorsResponse()
  queryAddressHierarchy(
    @Query() query: QueryAddressHierarchyDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.addressHierarchyService.getAll(query, originalUrl);
  }

  @Delete('/:id')
  //   @RequireSystemPermission({ addressHierarchy: ['delete'] })
  @ApiOperation({ summary: 'Delete AddressHierarchy' })
  @ApiOkResponse({ type: GetAddressHierarchyResponseDto })
  @ApiErrorsResponse()
  deleteAddressHierarchy(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
  ) {
    return this.addressHierarchyService.delete(id, query);
  }

  @Post('/:id/restore')
  @OptionalAuth()
  @ApiOperation({ summary: 'Restore AddressHierarchy' })
  @ApiOkResponse({ type: GetAddressHierarchyResponseDto })
  @ApiErrorsResponse()
  restoreAddressHierarchy(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.addressHierarchyService.restore(id, query);
  }
}
