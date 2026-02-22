export enum ExportResourceType {
  TRANSACTIONS = 'TRANSACTIONS',
  MERCHANTS = 'MERCHANTS',
  SETTLEMENTS = 'SETTLEMENTS',
  AUDIT_LOGS = 'AUDIT_LOGS',
  REFUNDS = 'REFUNDS',
}

export enum ExportFormat {
  CSV = 'CSV',
  XLSX = 'XLSX',
}

export enum ExportStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}
