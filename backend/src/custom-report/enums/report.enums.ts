export enum ReportDataSource {
  TRANSACTIONS = 'TRANSACTIONS',
  MERCHANTS = 'MERCHANTS',
  SETTLEMENTS = 'SETTLEMENTS',
  FEES = 'FEES',
  REFUNDS = 'REFUNDS',
  AUDIT_LOGS = 'AUDIT_LOGS',
}

export enum ExportFormat {
  CSV = 'CSV',
  JSON = 'JSON',
  XLSX = 'XLSX',
}

export enum ReportRunStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ReportColumn {
  field: string; // e.g. 'merchant.businessName'
  alias: string; // e.g. 'Merchant Name'
  include: boolean;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: string | number | boolean | string[];
}

export interface ReportSort {
  field: string;
  direction: 'ASC' | 'DESC';
}
