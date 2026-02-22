import { ExportResourceType } from '../enums/export.enums';
import { ColumnDefinition } from './export-writer.util';

export const COLUMN_DEFINITIONS: Record<ExportResourceType, ColumnDefinition[]> = {
  [ExportResourceType.TRANSACTIONS]: [
    { key: 'id', header: 'Transaction ID' },
    { key: 'merchantId', header: 'Merchant ID' },
    { key: 'amount', header: 'Amount' },
    { key: 'currency', header: 'Currency' },
    { key: 'status', header: 'Status' },
    { key: 'createdAt', header: 'Created At' },
  ],
  [ExportResourceType.MERCHANTS]: [
    { key: 'id', header: 'Merchant ID' },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'status', header: 'Status' },
    { key: 'createdAt', header: 'Created At' },
  ],
  [ExportResourceType.SETTLEMENTS]: [
    { key: 'id', header: 'Settlement ID' },
    { key: 'merchantId', header: 'Merchant ID' },
    { key: 'amount', header: 'Amount' },
    { key: 'currency', header: 'Currency' },
    { key: 'settledAt', header: 'Settled At' },
  ],
  [ExportResourceType.AUDIT_LOGS]: [
    { key: 'id', header: 'Log ID' },
    { key: 'adminId', header: 'Admin ID' },
    { key: 'action', header: 'Action' },
    { key: 'resourceType', header: 'Resource Type' },
    { key: 'resourceId', header: 'Resource ID' },
    { key: 'createdAt', header: 'Created At' },
  ],
  [ExportResourceType.REFUNDS]: [
    { key: 'id', header: 'Refund ID' },
    { key: 'transactionId', header: 'Transaction ID' },
    { key: 'amount', header: 'Amount' },
    { key: 'status', header: 'Status' },
    { key: 'reason', header: 'Reason' },
    { key: 'createdAt', header: 'Created At' },
  ],
};
