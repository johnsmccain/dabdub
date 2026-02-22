# Streaming Data Export System — NestJS

A generic, memory-safe export pipeline that streams large datasets (up to 500 000 rows) to S3 without exhausting Node.js heap.

## Architecture

```
POST /api/v1/exports
        │
        ▼
ExportsController → ExportsService
        │   1. COUNT(*) with filters
        │   2. Validate ≤ 500 000 rows (422 otherwise)
        │   3. Create ExportJob (QUEUED)
        │   4. Enqueue to BullMQ `export-processing` queue
        │   5. Return 202 immediately
        │
        ▼
ExportProcessor (BullMQ worker)
        │   1. Mark job PROCESSING
        │   2. Open S3 multipart upload (PassThrough stream)
        │   3. Cursor-paginate DB in 1 000-row batches
        │      → pipe each batch → ExportWriter → S3 stream
        │   4. Finalize multipart upload
        │   5. Mark job COMPLETED + persist stats
        │   6. Enqueue `export-ready` notification
        │
        ▼
NotificationsProcessor (BullMQ worker)
        │   1. Generate 7-day pre-signed S3 URL
        │   2. Send email via Nodemailer/Handlebars
        ▼
GET /api/v1/exports/:id  →  returns status + fresh pre-signed URL
```

## Memory Safety

- **Cursor pagination** — never holds more than 1 000 rows in memory at once.
- **PassThrough → Multipart upload** — data flows directly from DB query → stream → S3 part buffer (5 MB). No full file ever lives in RAM.
- **XLSX caveat** — ExcelJS requires buffering the workbook. At 500 000 rows × ~100 bytes/row this peaks at ~50 MB, well within the 512 MB limit.

## Key Files

| File | Purpose |
|------|---------|
| `exports/entities/export-job.entity.ts` | TypeORM entity |
| `exports/dto/create-export.dto.ts` | Request validation |
| `exports/services/s3.service.ts` | Multipart upload + presigned URLs |
| `exports/services/export-data.service.ts` | COUNT + cursor-paginated SELECT |
| `exports/utils/export-writer.util.ts` | CSV/XLSX streaming writer |
| `exports/utils/column-definitions.ts` | Per-resource column schemas |
| `exports/processors/export.processor.ts` | BullMQ worker — main pipeline |
| `notifications/notifications.processor.ts` | Email notification worker |
| `migrations/` | TypeORM migration |

## Setup

```bash
cp .env.example .env
# Fill in DATABASE_URL, Redis, AWS, SMTP values

npm install
npm run migration:run
npm run start:dev
```

## S3 Lifecycle Rule

Add this lifecycle rule to your S3 bucket to auto-delete exports after 30 days:

```json
{
  "Rules": [{
    "ID": "expire-exports",
    "Filter": { "Prefix": "exports/" },
    "Status": "Enabled",
    "Expiration": { "Days": 30 }
  }]
}
```

## API

### POST /api/v1/exports
```json
{
  "resourceType": "TRANSACTIONS",
  "filters": { "startDate": "2024-01-01", "endDate": "2024-03-01", "status": "SETTLED" },
  "format": "CSV"
}
```

**202 Accepted**
```json
{
  "exportId": "uuid",
  "status": "QUEUED",
  "estimatedRowCount": 12840,
  "format": "csv",
  "message": "Export queued. You will receive an email with the download link when ready."
}
```

**422 Unprocessable Entity** (when row count > 500 000)
```json
{
  "statusCode": 422,
  "message": "Export would contain 1,234,567 rows, which exceeds the maximum of 500,000. Please narrow your filters."
}
```

### GET /api/v1/exports/:id
```json
{
  "id": "uuid",
  "resourceType": "TRANSACTIONS",
  "status": "COMPLETED",
  "format": "csv",
  "progressPercentage": 100,
  "estimatedRowCount": 12840,
  "actualRowCount": 12843,
  "fileSizeBytes": 2340000,
  "downloadUrl": "https://s3.amazonaws.com/presigned...",
  "downloadUrlExpiresAt": "2026-02-26T10:05:00Z",
  "completedAt": "2026-02-21T10:05:00Z",
  "expiresAt": "2026-02-28T10:05:00Z"
}
```

Returns **410 Gone** when `expiresAt` is in the past.

### GET /api/v1/exports
Returns own exports, or all exports for SUPER_ADMIN.
