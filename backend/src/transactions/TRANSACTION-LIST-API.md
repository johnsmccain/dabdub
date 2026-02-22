# High-Performance Transaction List API

## Overview

This implementation provides a high-performance transaction list endpoint designed to handle millions of records efficiently. It supports real-time monitoring and compliance investigations with advanced filtering, aggregates, and async exports.

## Endpoint

```
GET /api/v1/transactions
```

## Features

### 1. Advanced Filtering

All filters are optional and can be combined:

- `merchantId` (UUID) - Filter by merchant
- `status` (enum) - Transaction status (PENDING_CONFIRMATION, CONFIRMED, SETTLEMENT_PENDING, SETTLED, FAILED, REFUNDED)
- `chain` (string) - Blockchain network (base, ethereum, polygon, etc.)
- `tokenSymbol` (string) - Token symbol (USDC, ETH, etc.)
- `minAmountUsd` (decimal) - Minimum USD amount
- `maxAmountUsd` (decimal) - Maximum USD amount
- `createdAfter` (ISO 8601) - Transactions created after this date (inclusive)
- `createdBefore` (ISO 8601) - Transactions created before this date (inclusive)
- `flaggedOnly` (boolean) - Show only flagged transactions
- `txHash` (string) - Exact transaction hash match

### 2. Sorting

- `sortBy` - Field to sort by: `createdAt`, `usdAmount`, `feeCollectedUsd`, `confirmedAt` (default: `createdAt`)
- `sortOrder` - Sort direction: `ASC` or `DESC` (default: `DESC`)

### 3. Pagination

Two pagination strategies:

#### Offset-based (default)
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20, max: 100)

#### Cursor-based (for large datasets)
- `cursor` (string) - Opaque cursor token from previous response
- Automatically used when `total > 10,000` records

### 4. Aggregates

Every response includes aggregate statistics:

```json
{
  "aggregates": {
    "totalVolumeUsd": "45231000.00",
    "totalFeesUsd": "678465.00",
    "countByStatus": {
      "PENDING_CONFIRMATION": 12,
      "CONFIRMED": 45,
      "SETTLEMENT_PENDING": 230,
      "SETTLED": 151890,
      "FAILED": 198,
      "REFUNDED": 55
    }
  }
}
```

### 5. Async Export

Trigger an async export job:

```
GET /api/v1/transactions?export=true&[filters...]
```

Returns immediately with:

```json
{
  "jobId": "uuid",
  "estimatedRecords": 152430
}
```

The export job runs in the background and generates a CSV file with all matching records.

## Performance Optimizations

### Database Indexes

The following indexes are created for optimal query performance:

1. `(payment_request_id, created_at)` - Merchant filtering with date range
2. `(status, created_at)` - Status filtering with date range
3. `(network, token_symbol)` - Chain and token filtering
4. `(tx_hash)` - Exact hash lookup
5. `(flagged_for_review)` - Flagged transaction filtering

### Caching Strategy

- **Count queries**: Cached for 15 seconds (accepts slight staleness)
- **Aggregates**: Cached for 15 seconds per filter combination
- **Transaction details**: Cached for 30 seconds

### Query Optimization

1. **Exact hash match**: Returns immediately without scanning other filters
2. **Cursor pagination**: Used automatically for large result sets (>10,000 records)
3. **Aggregate queries**: Executed separately from data queries for efficiency
4. **Streaming exports**: Large exports use streaming to avoid memory issues

## Example Requests

### Basic list
```
GET /api/v1/transactions?page=1&limit=20
```

### Filter by merchant and status
```
GET /api/v1/transactions?merchantId=uuid&status=SETTLED
```

### Date range with sorting
```
GET /api/v1/transactions?createdAfter=2024-01-01&createdBefore=2024-12-31&sortBy=usdAmount&sortOrder=DESC
```

### Flagged transactions only
```
GET /api/v1/transactions?flaggedOnly=true
```

### Exact hash lookup
```
GET /api/v1/transactions?txHash=0x1234...
```

### Trigger export
```
GET /api/v1/transactions?export=true&status=SETTLED&createdAfter=2024-01-01
```

## Response Format

```json
{
  "data": [
    {
      "id": "uuid",
      "merchantId": "uuid",
      "txHash": "0x...",
      "chain": "base",
      "tokenAddress": "0x...",
      "tokenSymbol": "USDC",
      "tokenAmount": "100.000000",
      "usdAmount": "100.00",
      "blockNumber": 12345678,
      "confirmations": 12,
      "status": "SETTLED",
      "feeCollectedUsd": "1.50",
      "networkFeeUsd": "0.25",
      "settlementId": "uuid",
      "flaggedForReview": false,
      "failureReason": null,
      "confirmedAt": "2024-01-15T10:30:00Z",
      "settledAt": "2024-01-15T11:00:00Z",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 152430,
    "page": 1,
    "limit": 20,
    "totalPages": 7622,
    "nextCursor": "eyJ2YWx1ZSI6IjIwMjQtMDEtMTVUMTA6MDA6MDBaIiwiaWQiOiJ1dWlkIn0="
  },
  "aggregates": {
    "totalVolumeUsd": "45231000.00",
    "totalFeesUsd": "678465.00",
    "countByStatus": {
      "SETTLED": 151890,
      "CONFIRMED": 45
    }
  }
}
```

## Performance Targets

- Query execution: < 300ms for filtered sets up to 50,000 records
- Aggregate calculation: < 100ms (with caching)
- Export trigger: < 50ms (returns immediately)

## Migration

Run the migration to add required indexes and columns:

```bash
npm run migration:run
```

Migration file: `1740000000000-AddTransactionPerformanceIndexes.ts`

## Testing

### Manual Testing

```bash
# Basic list
curl http://localhost:3000/api/v1/transactions

# With filters
curl "http://localhost:3000/api/v1/transactions?status=SETTLED&limit=10"

# Trigger export
curl "http://localhost:3000/api/v1/transactions?export=true&status=SETTLED"
```

### Load Testing

For production readiness, test with:
- 1M+ records in database
- Concurrent requests (50+ simultaneous users)
- Various filter combinations
- Large exports (100k+ records)

## Notes

- The legacy endpoint `GET /api/v1/transactions/legacy` is maintained for backward compatibility
- Export jobs are processed asynchronously via Bull queue
- Cursor pagination is automatically used when total > 10,000 records
- All date filters are inclusive
- Transaction hash lookup is exact match only (no partial matching)
