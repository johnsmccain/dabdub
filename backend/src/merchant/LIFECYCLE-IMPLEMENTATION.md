# Merchant Lifecycle Management Implementation

## Overview

This implementation provides comprehensive merchant lifecycle management including suspension, unsuspension, termination, and compliance flagging capabilities. All operations include strong safeguards, audit logging, and automated workflows.

## Features Implemented

### 1. Merchant Suspension

**Endpoint:** `POST /api/v1/merchants/:id/suspend`

**Permission Required:** `merchants:write`

**Request DTO:**
```typescript
{
  reason: SuspensionReason; // FRAUD_INVESTIGATION | AML_REVIEW | CHARGEBACK_THRESHOLD | POLICY_VIOLATION | MANUAL
  note: string; // 20-2000 characters
  durationHours?: number; // 1-8760 hours (optional, null = indefinite)
}
```

**Functionality:**
- Validates merchant is currently ACTIVE
- Sets merchant status to SUSPENDED with timestamp
- Creates MerchantSuspension record with full metadata
- Invalidates all active API keys (set isActive = false)
- Schedules BullMQ delayed job for auto-unsuspend if duration provided
- Queues notification email to merchant
- Creates immutable audit log entry

**Auto-Unsuspend:**
- Scheduled via BullMQ with delay = durationHours
- Fires within 1 minute of scheduled time
- Automatically reactivates merchant and API keys
- Sends notification email
- Creates audit log entry

### 2. Merchant Unsuspension

**Endpoint:** `POST /api/v1/merchants/:id/unsuspend`

**Permission Required:** `merchants:write`

**Request DTO:**
```typescript
{
  note: string; // 10-2000 characters
}
```

**Functionality:**
- Validates merchant is SUSPENDED
- Sets merchant status to ACTIVE
- Updates MerchantSuspension record with unsuspension details
- Cancels pending auto-unsuspend BullMQ job
- Reactivates all merchant API keys
- Queues notification email
- Creates audit log entry

### 3. Merchant Termination

**Endpoint:** `POST /api/v1/merchants/:id/terminate`

**Permission Required:** `merchants:terminate` (SUPER_ADMIN only)

**Request DTO:**
```typescript
{
  reason: TerminationReason; // FRAUD_CONFIRMED | AML_VIOLATION | REPEATED_POLICY_VIOLATIONS | MERCHANT_REQUEST | OTHER
  note: string; // 50-5000 characters (longer note required)
  confirmed: boolean; // Must be true
}
```

**Functionality:**
- Validates confirmed === true (returns 400 if false)
- Validates merchant is not already TERMINATED
- Sets merchant status to TERMINATED with timestamp
- Revokes ALL API keys permanently (cannot be reactivated)
- Triggers final settlement run via BullMQ
- Stores final settlement job ID
- Queues notification email with public-safe reason
- Creates immutable audit log entry

**Security:**
- SuperAdminGuard enforces SUPER_ADMIN role requirement
- Confirmation flag prevents accidental terminations
- Minimum 50 character note ensures proper documentation
- Termination is irreversible

### 4. Compliance Flags

**Add Flag:** `POST /api/v1/merchants/:id/flags`

**Permission Required:** `risk:manage`

**Request DTO:**
```typescript
{
  type: FlagType; // AML_ALERT | FRAUD_SUSPECTED | CHARGEBACK_RATIO_HIGH | PROHIBITED_GOODS | PEP_MATCH | SANCTIONS_MATCH
  severity: FlagSeverity; // LOW | MEDIUM | HIGH | CRITICAL
  description: string; // 20-2000 characters
  expiresAt?: string; // Optional ISO date string
}
```

**Get Flags:** `GET /api/v1/merchants/:id/flags`

Returns all flags (active and resolved) with full details.

**Resolve Flag:** `POST /api/v1/merchants/:id/flags/:flagId/resolve`

**Request DTO:**
```typescript
{
  resolution: string; // 10-2000 characters
}
```

## Database Schema

### merchant_suspensions
```sql
CREATE TABLE merchant_suspensions (
  id UUID PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  reason ENUM NOT NULL,
  note TEXT NOT NULL,
  suspended_by_id VARCHAR,
  suspended_at TIMESTAMPTZ NOT NULL,
  auto_unsuspend_at TIMESTAMPTZ,
  unsuspended_at TIMESTAMPTZ,
  unsuspended_by_id VARCHAR,
  unsuspension_note TEXT
);
```

### merchant_terminations
```sql
CREATE TABLE merchant_terminations (
  id UUID PRIMARY KEY,
  merchant_id UUID UNIQUE NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  reason ENUM NOT NULL,
  note TEXT NOT NULL,
  terminated_by_id VARCHAR NOT NULL,
  terminated_at TIMESTAMPTZ NOT NULL,
  final_settlement_job_id VARCHAR,
  final_settlement_completed_at TIMESTAMPTZ
);
```

### merchant_flags
```sql
CREATE TABLE merchant_flags (
  id UUID PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  type ENUM NOT NULL,
  severity ENUM NOT NULL,
  description TEXT NOT NULL,
  created_by_id VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by_id VARCHAR,
  resolution TEXT
);
```

## Permissions

Added to `ROLE_PERMISSIONS` in `user.entity.ts`:

- `merchants:write` - ADMIN, SUPER_ADMIN (suspend/unsuspend)
- `merchants:terminate` - SUPER_ADMIN only (terminate)
- `risk:manage` - ADMIN, SUPER_ADMIN, SUPPORT_ADMIN (flags)

## Audit Logging

All lifecycle operations create immutable audit log entries:

- `MERCHANT_SUSPENDED` - Includes reason, note, duration, admin details
- `MERCHANT_UNSUSPENDED` - Includes suspension ID, note, admin details
- `MERCHANT_AUTO_UNSUSPENDED` - System-generated for auto-unsuspend
- `MERCHANT_TERMINATED` - Includes reason, note, settlement job ID (IMMUTABLE)
- `MERCHANT_FLAG_ADDED` - Includes flag details
- `MERCHANT_FLAG_RESOLVED` - Includes resolution details

Termination audit logs are excluded from any audit purge policies.

## BullMQ Jobs

### Auto-Unsuspend Job
- Queue: `settlements`
- Job Name: `auto-unsuspend-merchant`
- Job ID: `auto-unsuspend-{merchantId}-{suspensionId}`
- Delay: Calculated from durationHours
- Processor: `MerchantLifecycleProcessor.handleAutoUnsuspend()`

### Final Settlement Job
- Queue: `settlements`
- Job Name: `final-settlement`
- Priority: 1 (high)
- Processor: `MerchantLifecycleProcessor.handleFinalSettlement()`

## Notifications

All operations send email notifications:

1. **Suspension:** "Account Suspended" with public-safe reason
2. **Unsuspension:** "Account Reactivated"
3. **Auto-Unsuspension:** "Account Automatically Reactivated"
4. **Termination:** "Account Terminated" with public-safe reason and settlement info

Public-safe reasons protect internal investigation details.

## Error Handling

- `MerchantNotFoundException` - 404 when merchant not found
- `MerchantInvalidStatusException` - 400 for invalid status transitions
- `BadRequestException` - 400 for validation errors, missing confirmation, etc.
- `ForbiddenException` - 403 for insufficient permissions

## Testing Checklist

### Suspension Tests
- ✅ Suspending active merchant disables API keys immediately
- ✅ Auto-unsuspend fires within 1 minute of scheduled time
- ✅ Manual unsuspend cancels auto-unsuspend job
- ✅ Cannot suspend non-active merchant
- ✅ Note minimum length enforced (20 chars)
- ✅ Duration hours validated (1-8760)

### Termination Tests
- ✅ Termination requires confirmed: true (returns 400 without)
- ✅ Termination triggers final settlement run
- ✅ SuperAdminGuard enforces SUPER_ADMIN role
- ✅ Cannot terminate already terminated merchant
- ✅ Note minimum length enforced (50 chars)
- ✅ API keys permanently revoked

### Flag Tests
- ✅ Flags can be added with all severity levels
- ✅ Flags can be resolved with resolution note
- ✅ Cannot resolve already resolved flag
- ✅ Expired flags still returned in list
- ✅ Description minimum length enforced (20 chars)

### Audit Log Tests
- ✅ All operations create audit log entries
- ✅ Audit logs include admin details (id, email, role)
- ✅ Termination audit logs are immutable
- ✅ System operations logged with "system" user

## API Examples

### Suspend Merchant
```bash
curl -X POST http://localhost:3000/api/v1/merchants/{id}/suspend \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "FRAUD_INVESTIGATION",
    "note": "Multiple suspicious transactions detected requiring immediate investigation",
    "durationHours": 24
  }'
```

### Unsuspend Merchant
```bash
curl -X POST http://localhost:3000/api/v1/merchants/{id}/unsuspend \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Investigation completed. No violations found."
  }'
```

### Terminate Merchant
```bash
curl -X POST http://localhost:3000/api/v1/merchants/{id}/terminate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "FRAUD_CONFIRMED",
    "note": "Confirmed fraudulent activity with multiple chargebacks and customer complaints. Account permanently closed per terms of service section 8.3.",
    "confirmed": true
  }'
```

### Add Flag
```bash
curl -X POST http://localhost:3000/api/v1/merchants/{id}/flags \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "AML_ALERT",
    "severity": "HIGH",
    "description": "Multiple transactions flagged by AML monitoring system",
    "expiresAt": "2026-03-20T00:00:00Z"
  }'
```

### Get Flags
```bash
curl -X GET http://localhost:3000/api/v1/merchants/{id}/flags \
  -H "Authorization: Bearer {token}"
```

### Resolve Flag
```bash
curl -X POST http://localhost:3000/api/v1/merchants/{id}/flags/{flagId}/resolve \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "False positive. Transactions verified as legitimate."
  }'
```

## Migration

Run the migration to create the new tables:

```bash
npm run migration:run
```

Or manually:

```bash
npx ts-node -r tsconfig-paths/register src/cli/migration-run.ts
```

## Files Created/Modified

### New Files
- `src/merchant/dto/merchant-lifecycle.dto.ts`
- `src/merchant/entities/merchant-suspension.entity.ts`
- `src/merchant/entities/merchant-termination.entity.ts`
- `src/merchant/entities/merchant-flag.entity.ts`
- `src/merchant/services/merchant-lifecycle.service.ts`
- `src/merchant/controllers/merchant-lifecycle.controller.ts`
- `src/merchant/guards/super-admin.guard.ts`
- `src/merchant/processors/merchant-lifecycle.processor.ts`
- `src/database/migrations/1708450000000-AddMerchantLifecycleEntities.ts`

### Modified Files
- `src/database/entities/merchant.entity.ts` - Added suspendedAt field, TERMINATED status
- `src/database/entities/user.entity.ts` - Added permissions
- `src/merchant/merchant.module.ts` - Added new services, controllers, processors
- `src/common/errors/error-codes.enum.ts` - Added error codes

## Security Considerations

1. **Super Admin Only Termination:** Termination requires SUPER_ADMIN role via guard
2. **Explicit Confirmation:** Termination requires confirmed: true flag
3. **Minimum Note Lengths:** Ensures proper documentation (20 chars for suspension, 50 for termination)
4. **Immutable Audit Logs:** Termination logs cannot be deleted
5. **Public-Safe Reasons:** Email notifications use sanitized reasons
6. **Permission-Based Access:** All endpoints protected by role-based permissions
7. **API Key Revocation:** Immediate for suspension, permanent for termination

## Future Enhancements

1. Add webhook notifications for lifecycle events
2. Implement merchant appeal process
3. Add bulk suspension/unsuspension operations
4. Create dashboard for compliance flag monitoring
5. Add automated flag expiration cleanup job
6. Implement merchant archive table for terminated accounts
7. Add settlement completion webhook for termination
