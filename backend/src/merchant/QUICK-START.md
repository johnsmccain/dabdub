# Merchant Lifecycle Management - Quick Start Guide

## Setup

1. **Run Migration:**
```bash
npm run migration:run
```

2. **Verify Module Import:**
Ensure `MerchantModule` is imported in `app.module.ts`

3. **Verify Queue Configuration:**
Ensure BullMQ queues are configured in your app module:
- `settlements`
- `notifications`

## API Endpoints

### Suspend Merchant
```
POST /api/v1/merchants/:id/suspend
Authorization: Bearer {admin_token}
Permission: merchants:write
```

### Unsuspend Merchant
```
POST /api/v1/merchants/:id/unsuspend
Authorization: Bearer {admin_token}
Permission: merchants:write
```

### Terminate Merchant
```
POST /api/v1/merchants/:id/terminate
Authorization: Bearer {super_admin_token}
Permission: merchants:terminate (SUPER_ADMIN only)
```

### Add Compliance Flag
```
POST /api/v1/merchants/:id/flags
Authorization: Bearer {admin_token}
Permission: risk:manage
```

### Get Merchant Flags
```
GET /api/v1/merchants/:id/flags
Authorization: Bearer {admin_token}
Permission: risk:manage
```

### Resolve Flag
```
POST /api/v1/merchants/:id/flags/:flagId/resolve
Authorization: Bearer {admin_token}
Permission: risk:manage
```

## Key Features

✅ **Suspension with Auto-Unsuspend**
- Set duration in hours (1-8760)
- Automatic reactivation via BullMQ
- Fires within 1 minute of scheduled time

✅ **Permanent Termination**
- Requires SUPER_ADMIN role
- Must confirm with `confirmed: true`
- Triggers final settlement
- Irreversible operation

✅ **Compliance Flags**
- 6 flag types (AML, Fraud, Chargeback, etc.)
- 4 severity levels (LOW, MEDIUM, HIGH, CRITICAL)
- Optional expiration dates
- Resolution tracking

✅ **Audit Logging**
- All operations logged
- Termination logs are immutable
- Includes admin details

✅ **Email Notifications**
- Sent for all lifecycle events
- Public-safe reasons
- Queued via BullMQ

## Validation Rules

### Suspension
- Note: 20-2000 characters
- Duration: 1-8760 hours (optional)
- Merchant must be ACTIVE

### Unsuspension
- Note: 10-2000 characters
- Merchant must be SUSPENDED

### Termination
- Note: 50-5000 characters (longer required)
- confirmed: must be true
- Merchant cannot already be TERMINATED

### Flags
- Description: 20-2000 characters
- Resolution: 10-2000 characters

## Testing

### Test Suspension
```bash
curl -X POST http://localhost:3000/api/v1/merchants/{id}/suspend \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "MANUAL",
    "note": "Testing suspension functionality with minimum note length",
    "durationHours": 1
  }'
```

### Test Auto-Unsuspend
Wait 1 hour (or adjust durationHours) and verify:
- Merchant status changes to ACTIVE
- API keys are reactivated
- Email notification sent
- Audit log created

### Test Termination
```bash
curl -X POST http://localhost:3000/api/v1/merchants/{id}/terminate \
  -H "Authorization: Bearer {super_admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "MERCHANT_REQUEST",
    "note": "Merchant requested account closure. All outstanding transactions will be settled. Account closed per merchant request on 2026-02-20.",
    "confirmed": true
  }'
```

### Test Without Confirmation (Should Fail)
```bash
curl -X POST http://localhost:3000/api/v1/merchants/{id}/terminate \
  -H "Authorization: Bearer {super_admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "MERCHANT_REQUEST",
    "note": "This should fail because confirmed is not true",
    "confirmed": false
  }'
```
Expected: 400 Bad Request

## Troubleshooting

### Auto-Unsuspend Not Firing
1. Check BullMQ queue is running
2. Verify job was created: Check `settlements` queue
3. Check logs for processor errors
4. Verify job ID format: `auto-unsuspend-{merchantId}-{suspensionId}`

### Termination Fails
1. Verify user has SUPER_ADMIN role
2. Ensure `confirmed: true` is set
3. Check merchant is not already terminated
4. Verify note is at least 50 characters

### API Keys Not Reactivating
1. Check merchant status is ACTIVE
2. Verify API keys exist for merchant
3. Check database: `SELECT * FROM api_keys WHERE merchant_id = '{id}'`

### Permissions Denied
1. Verify user role in JWT token
2. Check ROLE_PERMISSIONS in user.entity.ts
3. Ensure guards are properly applied

## Database Queries

### Check Suspension Status
```sql
SELECT * FROM merchant_suspensions 
WHERE merchant_id = '{id}' 
ORDER BY suspended_at DESC 
LIMIT 1;
```

### Check Active Flags
```sql
SELECT * FROM merchant_flags 
WHERE merchant_id = '{id}' 
AND resolved_at IS NULL;
```

### Check Termination
```sql
SELECT * FROM merchant_terminations 
WHERE merchant_id = '{id}';
```

### Check Audit Logs
```sql
SELECT * FROM merchant_audit_logs 
WHERE merchant_id = '{id}' 
ORDER BY created_at DESC;
```

## Common Issues

**Issue:** "Merchant is not suspended"
**Solution:** Check merchant status. Only SUSPENDED merchants can be unsuspended.

**Issue:** "Super Admin role required"
**Solution:** Termination requires SUPER_ADMIN role. Check user.role in JWT.

**Issue:** "Termination must be explicitly confirmed"
**Solution:** Set `confirmed: true` in request body.

**Issue:** "Note too short"
**Solution:** 
- Suspension: minimum 20 characters
- Termination: minimum 50 characters
- Flags: minimum 20 characters

## Next Steps

1. Test all endpoints with Postman/curl
2. Verify auto-unsuspend fires correctly
3. Check email notifications are sent
4. Review audit logs for completeness
5. Test permission enforcement
6. Verify final settlement job creation

## Support

For issues or questions, refer to:
- `LIFECYCLE-IMPLEMENTATION.md` - Full documentation
- Audit logs - Check `merchant_audit_logs` table
- Application logs - Check NestJS logs for errors
