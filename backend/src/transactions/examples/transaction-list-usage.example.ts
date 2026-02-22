/**
 * Example usage of the high-performance transaction list API
 * 
 * This file demonstrates various use cases for the transaction list endpoint
 */

import { ListTransactionsQueryDto } from '../dto/transaction-query.dto';
import { TransactionStatus } from '../transactions.enums';

// Example 1: Basic pagination
const basicQuery: ListTransactionsQueryDto = {
  page: 1,
  limit: 20,
};

// Example 2: Filter by merchant and status
const merchantFilterQuery: ListTransactionsQueryDto = {
  merchantId: '123e4567-e89b-12d3-a456-426614174000',
  status: TransactionStatus.SETTLED,
  page: 1,
  limit: 50,
};

// Example 3: Date range with amount filtering
const dateRangeQuery: ListTransactionsQueryDto = {
  createdAfter: '2024-01-01T00:00:00Z',
  createdBefore: '2024-12-31T23:59:59Z',
  minAmountUsd: '100.00',
  maxAmountUsd: '10000.00',
  sortBy: 'usdAmount',
  sortOrder: 'DESC',
  page: 1,
  limit: 20,
};

// Example 4: Chain and token filtering
const chainTokenQuery: ListTransactionsQueryDto = {
  chain: 'base',
  tokenSymbol: 'USDC',
  status: TransactionStatus.CONFIRMED,
  page: 1,
  limit: 100,
};

// Example 5: Flagged transactions only
const flaggedQuery: ListTransactionsQueryDto = {
  flaggedOnly: true,
  sortBy: 'createdAt',
  sortOrder: 'DESC',
  page: 1,
  limit: 20,
};

// Example 6: Exact hash lookup
const hashLookupQuery: ListTransactionsQueryDto = {
  txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
};

// Example 7: Cursor-based pagination for large datasets
const cursorQuery: ListTransactionsQueryDto = {
  cursor: 'eyJ2YWx1ZSI6IjIwMjQtMDEtMTVUMTA6MDA6MDBaIiwiaWQiOiJ1dWlkIn0=',
  limit: 50,
};

// Example 8: Trigger async export
const exportQuery: ListTransactionsQueryDto = {
  status: TransactionStatus.SETTLED,
  createdAfter: '2024-01-01T00:00:00Z',
  createdBefore: '2024-12-31T23:59:59Z',
  export: true,
};

// Example 9: Complex compliance query
const complianceQuery: ListTransactionsQueryDto = {
  merchantId: '123e4567-e89b-12d3-a456-426614174000',
  minAmountUsd: '10000.00', // Large transactions
  flaggedOnly: true,
  createdAfter: '2024-01-01T00:00:00Z',
  sortBy: 'usdAmount',
  sortOrder: 'DESC',
  page: 1,
  limit: 100,
};

// Example 10: Real-time monitoring query
const monitoringQuery: ListTransactionsQueryDto = {
  status: TransactionStatus.PENDING_CONFIRMATION,
  createdAfter: new Date(Date.now() - 3600000).toISOString(), // Last hour
  sortBy: 'createdAt',
  sortOrder: 'DESC',
  page: 1,
  limit: 50,
};

/**
 * Example API calls using fetch
 */

// Basic list
async function fetchBasicList() {
  const response = await fetch('http://localhost:3000/api/v1/transactions?page=1&limit=20');
  const data = await response.json();
  console.log('Total transactions:', data.meta.total);
  console.log('Total volume:', data.aggregates.totalVolumeUsd);
  return data;
}

// Filter by status
async function fetchSettledTransactions() {
  const response = await fetch(
    'http://localhost:3000/api/v1/transactions?status=SETTLED&page=1&limit=50'
  );
  const data = await response.json();
  console.log('Settled transactions:', data.data.length);
  return data;
}

// Date range query
async function fetchTransactionsByDateRange(startDate: string, endDate: string) {
  const params = new URLSearchParams({
    createdAfter: startDate,
    createdBefore: endDate,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    page: '1',
    limit: '20',
  });
  
  const response = await fetch(`http://localhost:3000/api/v1/transactions?${params}`);
  const data = await response.json();
  return data;
}

// Trigger export
async function triggerExport(filters: Record<string, string>) {
  const params = new URLSearchParams({ ...filters, export: 'true' });
  const response = await fetch(`http://localhost:3000/api/v1/transactions?${params}`);
  const data = await response.json();
  console.log('Export job ID:', data.jobId);
  console.log('Estimated records:', data.estimatedRecords);
  return data;
}

// Cursor pagination
async function fetchWithCursor(cursor?: string) {
  const params = new URLSearchParams({
    limit: '50',
    ...(cursor && { cursor }),
  });
  
  const response = await fetch(`http://localhost:3000/api/v1/transactions?${params}`);
  const data = await response.json();
  
  console.log('Fetched:', data.data.length, 'transactions');
  
  // If there's a next cursor, fetch the next page
  if (data.meta.nextCursor) {
    console.log('Next cursor available:', data.meta.nextCursor);
    // Recursively fetch next page
    // await fetchWithCursor(data.meta.nextCursor);
  }
  
  return data;
}

/**
 * Example response structure
 */
const exampleResponse = {
  data: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      merchantId: '123e4567-e89b-12d3-a456-426614174001',
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      chain: 'base',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      tokenSymbol: 'USDC',
      tokenAmount: '100.000000',
      usdAmount: '100.00',
      blockNumber: 12345678,
      confirmations: 12,
      status: 'SETTLED',
      feeCollectedUsd: '1.50',
      networkFeeUsd: '0.25',
      settlementId: '123e4567-e89b-12d3-a456-426614174002',
      flaggedForReview: false,
      failureReason: null,
      confirmedAt: '2024-01-15T10:30:00Z',
      settledAt: '2024-01-15T11:00:00Z',
      createdAt: '2024-01-15T10:00:00Z',
    },
  ],
  meta: {
    total: 152430,
    page: 1,
    limit: 20,
    totalPages: 7622,
    nextCursor: 'eyJ2YWx1ZSI6IjIwMjQtMDEtMTVUMTA6MDA6MDBaIiwiaWQiOiJ1dWlkIn0=',
  },
  aggregates: {
    totalVolumeUsd: '45231000.00',
    totalFeesUsd: '678465.00',
    countByStatus: {
      PENDING_CONFIRMATION: 12,
      CONFIRMED: 45,
      SETTLEMENT_PENDING: 230,
      SETTLED: 151890,
      FAILED: 198,
      REFUNDED: 55,
    },
  },
};

export {
  basicQuery,
  merchantFilterQuery,
  dateRangeQuery,
  chainTokenQuery,
  flaggedQuery,
  hashLookupQuery,
  cursorQuery,
  exportQuery,
  complianceQuery,
  monitoringQuery,
  fetchBasicList,
  fetchSettledTransactions,
  fetchTransactionsByDateRange,
  triggerExport,
  fetchWithCursor,
  exampleResponse,
};
