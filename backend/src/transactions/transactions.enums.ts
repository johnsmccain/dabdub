export enum TransactionType {
  DEPOSIT = 'deposit',
  SETTLEMENT = 'settlement',
  REFUND = 'refund',
}

export enum TransactionStatus {
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  SETTLEMENT_PENDING = 'SETTLEMENT_PENDING',
  SETTLED = 'SETTLED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  // Legacy statuses for backward compatibility
  PENDING = 'pending',
  REPLACED = 'replaced',
}