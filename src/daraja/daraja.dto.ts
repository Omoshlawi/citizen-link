import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── OAuth token ──────────────────────────────────────────────────────────────

export class DarajaTokenResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  expires_in!: string;
}

// ── STK push (C2B) ───────────────────────────────────────────────────────────

export class StkPushResponseDto {
  @ApiProperty()
  MerchantRequestID!: string;

  @ApiProperty()
  CheckoutRequestID!: string;

  @ApiProperty({ example: '0' })
  ResponseCode!: string;

  @ApiProperty()
  ResponseDescription!: string;

  @ApiProperty()
  CustomerMessage!: string;
}

export class StkCallbackMetadataItemDto {
  @ApiProperty()
  Name!: string;

  @ApiPropertyOptional({ oneOf: [{ type: 'string' }, { type: 'number' }] })
  Value?: string | number;
}

export class StkCallbackMetadataDto {
  @ApiProperty({ type: [StkCallbackMetadataItemDto] })
  Item!: StkCallbackMetadataItemDto[];
}

export class StkCallbackDto {
  @ApiProperty()
  MerchantRequestID!: string;

  @ApiProperty()
  CheckoutRequestID!: string;

  @ApiProperty({ description: '0 = success' })
  ResultCode!: number;

  @ApiProperty()
  ResultDesc!: string;

  @ApiPropertyOptional({ type: StkCallbackMetadataDto })
  CallbackMetadata?: StkCallbackMetadataDto;
}

export class StkCallbackBodyInnerDto {
  @ApiProperty({ type: StkCallbackDto })
  stkCallback!: StkCallbackDto;
}

export class StkCallbackBodyDto {
  @ApiProperty({ type: StkCallbackBodyInnerDto })
  Body!: StkCallbackBodyInnerDto;
}

// ── B2C (Business-to-Customer) ───────────────────────────────────────────────

export class B2CResponseDto {
  @ApiProperty()
  ConversationID!: string;

  @ApiProperty()
  OriginatorConversationID!: string;

  @ApiProperty({ example: '0' })
  ResponseCode!: string;

  @ApiProperty()
  ResponseDescription!: string;
}

export class B2CResultParameterItemDto {
  @ApiProperty()
  Key!: string;

  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }] })
  Value!: string | number;
}

export class B2CResultParametersDto {
  @ApiProperty({ type: [B2CResultParameterItemDto] })
  ResultParameter!: B2CResultParameterItemDto[];
}

export class B2CReferenceItemDto {
  @ApiProperty()
  Key!: string;

  @ApiProperty()
  Value!: string;
}

export class B2CReferenceDataDto {
  @ApiProperty({ type: B2CReferenceItemDto })
  ReferenceItem!: B2CReferenceItemDto;
}

export class B2CResultDto {
  @ApiProperty()
  ResultType!: number;

  @ApiProperty({ description: '0 = success' })
  ResultCode!: number;

  @ApiProperty()
  ResultDesc!: string;

  @ApiProperty()
  OriginatorConversationID!: string;

  @ApiProperty()
  ConversationID!: string;

  @ApiProperty({ description: 'M-Pesa receipt number' })
  TransactionID!: string;

  @ApiPropertyOptional({ type: B2CResultParametersDto })
  ResultParameters?: B2CResultParametersDto;

  @ApiPropertyOptional({ type: B2CReferenceDataDto })
  ReferenceData?: B2CReferenceDataDto;
}

export class B2CCallbackBodyDto {
  @ApiProperty({ type: B2CResultDto })
  Result!: B2CResultDto;
}
