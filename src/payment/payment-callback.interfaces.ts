export enum PaymentCallbackProvider {
  MPESA = 'MPESA',
  MAUZO = 'MAUZO',
}

export interface PaymentCallbackJob {
  provider: PaymentCallbackProvider;
  /** checkoutRequestId (STK / Mauzo payment intent) — used to look up the Transaction */
  correlationId: string;
  success: boolean;
  /** Provider receipt number / reference — populated on success */
  receiptNumber?: string;
  /** Settled amount, for verification and audit */
  amount?: number;
  errorCode?: number | string;
  errorMessage?: string;
  /** Original provider payload — stored for audit */
  raw: unknown;
}
