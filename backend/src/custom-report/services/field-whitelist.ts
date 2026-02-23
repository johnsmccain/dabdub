import { ReportDataSource } from '../enums/report.enums';

/**
 * Whitelist of safe, allowed fields per data source.
 *
 * Keys are the logical field names callers use in ReportColumn.field,
 * ReportFilter.field, and ReportSort.field.
 *
 * Values are the actual SQL column references (table alias + column name)
 * used inside TypeORM QueryBuilder.  No dynamic string building from user
 * input ever reaches the query — only whitelisted values do.
 */
export const FIELD_WHITELIST: Record<
  ReportDataSource,
  Record<string, string>
> = {
  [ReportDataSource.TRANSACTIONS]: {
    id: 't.id',
    txHash: 't.tx_hash',
    network: 't.network',
    status: 't.status',
    type: 't.type',
    fromAddress: 't.from_address',
    toAddress: 't.to_address',
    cryptoAmount: 't.crypto_amount',
    amount: 't.amount',
    tokenSymbol: 't.token_symbol',
    usdValue: 't.usd_value',
    isSandbox: 't.is_sandbox',
    createdAt: 't.created_at',
    updatedAt: 't.updated_at',
    paymentRequestId: 't.payment_request_id',
    'merchant.id': 'm.id',
    'merchant.name': 'm.name',
    'merchant.businessName': 'm.business_name',
    'merchant.email': 'm.email',
    'merchant.status': 'm.status',
    'merchant.kycStatus': 'm.kyc_status',
  },

  [ReportDataSource.MERCHANTS]: {
    id: 'm.id',
    name: 'm.name',
    businessName: 'm.business_name',
    email: 'm.email',
    phone: 'm.phone',
    status: 'm.status',
    kycStatus: 'm.kyc_status',
    bankAccountStatus: 'm.bank_account_status',
    createdAt: 'm.created_at',
    updatedAt: 'm.updated_at',
    kycVerifiedAt: 'm.kyc_verified_at',
    suspendedAt: 'm.suspended_at',
    closedAt: 'm.closed_at',
    apiQuotaUsed: 'm.api_quota_used',
  },

  [ReportDataSource.SETTLEMENTS]: {
    id: 's.id',
    status: 's.status',
    amount: 's.amount',
    currency: 's.currency',
    netAmount: 's.net_amount',
    feeAmount: 's.fee_amount',
    feePercentage: 's.fee_percentage',
    settledAt: 's.settled_at',
    createdAt: 's.created_at',
    provider: 's.provider',
    merchantId: 's.merchant_id',
    paymentRequestId: 's.payment_request_id',
    'merchant.name': 'm.name',
    'merchant.businessName': 'm.business_name',
    'merchant.email': 'm.email',
  },

  [ReportDataSource.FEES]: {
    merchantId: 'mfc.merchant_id',
    transactionFeePercentage: 'mfc.transaction_fee_percentage',
    transactionFeeFlat: 'mfc.transaction_fee_flat',
    settlementFeePercentage: 'mfc.settlement_fee_percentage',
    minimumFee: 'mfc.minimum_fee',
    maximumFee: 'mfc.maximum_fee',
    isCustom: 'mfc.is_custom',
    createdAt: 'mfc.created_at',
    updatedAt: 'mfc.updated_at',
    'merchant.name': 'm.name',
    'merchant.businessName': 'm.business_name',
    'merchant.email': 'm.email',
    'merchant.status': 'm.status',
  },

  [ReportDataSource.REFUNDS]: {
    id: 'pr.id',
    status: 'pr.status',
    amount: 'pr.amount',
    currency: 'pr.currency',
    createdAt: 'pr.created_at',
    updatedAt: 'pr.updated_at',
    merchantId: 'pr.merchant_id',
    customerEmail: 'pr.customer_email',
    stellarNetwork: 'pr.stellar_network',
    'merchant.name': 'm.name',
    'merchant.businessName': 'm.business_name',
  },

  [ReportDataSource.AUDIT_LOGS]: {
    id: 'al.id',
    entityType: 'al.entity_type',
    entityId: 'al.entity_id',
    action: 'al.action',
    actorId: 'al.actor_id',
    actorType: 'al.actor_type',
    ipAddress: 'al.ip_address',
    dataClassification: 'al.data_classification',
    createdAt: 'al.created_at',
  },
};

/** Returns the SQL column reference for a given field, or null if not whitelisted. */
export function resolveField(
  dataSource: ReportDataSource,
  field: string,
): string | null {
  return FIELD_WHITELIST[dataSource]?.[field] ?? null;
}

/** Returns all valid field names for a given data source. */
export function getAllowedFields(dataSource: ReportDataSource): string[] {
  return Object.keys(FIELD_WHITELIST[dataSource] ?? {});
}
