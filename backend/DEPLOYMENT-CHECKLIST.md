# Merchant Lifecycle Management - Deployment Checklist

## Pre-Deployment Checklist

### 1. Database Migration
- [ ] Review migration file: `src/database/migrations/1708450000000-AddMerchantLifecycleEntities.ts`
- [ ] Run migration in development: `npm run migration:run`
- [ ] Verify tables created:
  - [ ] `merchant_suspensions`
  - [ ] `merchant_terminations`
  - [ ] `merchant_flags`
- [ ] Verify merchant table updated:
  - [ ] `suspended_at` column added
  - [ ] `TERMINATED` status added to enum
- [ ] Verify indexes created correctly
- [ ] Verify foreign keys created correctly

### 2. Module Configuration
- [ ] Verify `MerchantModule` imports in `app.module.ts`
- [ ] Verify BullMQ queues configured:
  - [ ] `settlements` queue
  - [ ] `notifications` queue
- [ ] Verify TypeORM entities registered:
  - [ ] `MerchantSuspension`
  - [ ] `MerchantTermination`
  - [ ] `MerchantFlag`

### 3. Environment Variables
- [ ] JWT_SECRET configured
- [ ] Database connection configured
- [ ] Redis connection configured (for BullMQ)
- [ ] Email service configured (for notifications)

### 4. Permissions Setup
- [ ] Verify ROLE_PERMISSIONS updated in `user.entity.ts`
- [ ] Create test users with roles:
  - [ ] ADMIN user
  - [ ] SUPER_ADMIN user
  - [ ] SUPPORT_ADMIN user
- [ ] Generate JWT tokens for testing

## Testing Checklist

### Unit Tests (Recommended)
- [ ] Test `MerchantLifecycleService.suspendMerchant()`
- [ ] Test `MerchantLifecycleService.unsuspendMerchant()`
- [ ] Test `MerchantLifecycleService.terminateMerchant()`
- [ ] Test `MerchantLifecycleService.addFlag()`
- [ ] Test `MerchantLifecycleService.resolveFlag()`
- [ ] Test DTO validations
- [ ] Test SuperAdminGuard
- [ ] Test public-safe reason mapping

### Integration Tests

#### Suspension Flow
- [ ] Suspend active merchant
  - [ ] Verify status changed to SUSPENDED
  - [ ] Verify suspendedAt timestamp set
  - [ ] Verify API keys disabled
  - [ ] Verify suspension record created
  - [ ] Verify audit log created
  - [ ] Verify email notification queued
- [ ] Suspend with auto-unsuspend
  - [ ] Verify BullMQ job created
  - [ ] Verify job ID format correct
  - [ ] Verify delay calculated correctly
- [ ] Try to suspend non-active merchant
  - [ ] Verify 400 error returned
- [ ] Try to suspend with short note
  - [ ] Verify validation error

#### Unsuspension Flow
- [ ] Unsuspend suspended merchant
  - [ ] Verify status changed to ACTIVE
  - [ ] Verify suspendedAt cleared
  - [ ] Verify API keys reactivated
  - [ ] Verify suspension record updated
  - [ ] Verify auto-unsuspend job cancelled
  - [ ] Verify audit log created
  - [ ] Verify email notification queued
- [ ] Try to unsuspend non-suspended merchant
  - [ ] Verify 400 error returned

#### Auto-Unsuspend Flow
- [ ] Create suspension with 1-hour duration
- [ ] Wait for auto-unsuspend (should fire within 1 minute of scheduled time)
  - [ ] Verify merchant status changed to ACTIVE
  - [ ] Verify API keys reactivated
  - [ ] Verify suspension record updated
  - [ ] Verify audit log created with "system" user
  - [ ] Verify email notification sent
- [ ] Create suspension with auto-unsuspend, then manually unsuspend
  - [ ] Verify auto-unsuspend job cancelled
  - [ ] Verify job doesn't fire after manual unsuspend

#### Termination Flow
- [ ] Terminate merchant (SUPER_ADMIN)
  - [ ] Verify status changed to TERMINATED
  - [ ] Verify closedAt timestamp set
  - [ ] Verify API keys permanently revoked
  - [ ] Verify termination record created
  - [ ] Verify final settlement job created
  - [ ] Verify audit log created
  - [ ] Verify email notification queued
- [ ] Try to terminate without confirmation
  - [ ] Verify 400 error returned
- [ ] Try to terminate with ADMIN token
  - [ ] Verify 403 error returned
- [ ] Try to terminate already terminated merchant
  - [ ] Verify 400 error returned
- [ ] Try to terminate with short note
  - [ ] Verify validation error

#### Flag Management Flow
- [ ] Add flag to merchant
  - [ ] Verify flag created
  - [ ] Verify audit log created
- [ ] Get merchant flags
  - [ ] Verify all flags returned
  - [ ] Verify resolved and unresolved flags included
- [ ] Resolve flag
  - [ ] Verify resolvedAt timestamp set
  - [ ] Verify resolution note saved
  - [ ] Verify audit log created
- [ ] Try to resolve already resolved flag
  - [ ] Verify 400 error returned
- [ ] Add flag with expiration
  - [ ] Verify expiresAt set correctly
- [ ] Try to add flag with short description
  - [ ] Verify validation error

### Permission Tests
- [ ] Test suspend with ADMIN token (should succeed)
- [ ] Test suspend with SUPER_ADMIN token (should succeed)
- [ ] Test suspend with MERCHANT token (should fail)
- [ ] Test terminate with SUPER_ADMIN token (should succeed)
- [ ] Test terminate with ADMIN token (should fail)
- [ ] Test flags with ADMIN token (should succeed)
- [ ] Test flags with SUPPORT_ADMIN token (should succeed)

### API Response Tests
- [ ] Verify all responses include proper status codes
- [ ] Verify error responses follow ErrorResponseDto format
- [ ] Verify success responses include all required fields
- [ ] Verify Swagger documentation accessible

### Database Tests
- [ ] Verify foreign key constraints work
- [ ] Verify cascade deletes work correctly
- [ ] Verify indexes improve query performance
- [ ] Verify unique constraints enforced
- [ ] Verify audit logs created for all operations

### BullMQ Tests
- [ ] Verify jobs appear in queue dashboard
- [ ] Verify job data structure correct
- [ ] Verify job priorities set correctly
- [ ] Verify delayed jobs scheduled correctly
- [ ] Verify job cancellation works
- [ ] Verify processor handles errors gracefully

### Email Notification Tests
- [ ] Verify suspension email sent
- [ ] Verify unsuspension email sent
- [ ] Verify auto-unsuspension email sent
- [ ] Verify termination email sent
- [ ] Verify email content uses public-safe reasons
- [ ] Verify email metadata includes correct info

## Performance Testing

### Load Tests
- [ ] Test concurrent suspensions
- [ ] Test concurrent flag additions
- [ ] Test large number of flags per merchant
- [ ] Test auto-unsuspend with many scheduled jobs
- [ ] Monitor database query performance
- [ ] Monitor BullMQ queue performance

### Stress Tests
- [ ] Test with 1000+ merchants
- [ ] Test with 100+ flags per merchant
- [ ] Test with 100+ concurrent auto-unsuspend jobs
- [ ] Monitor memory usage
- [ ] Monitor CPU usage

## Security Testing

### Authentication Tests
- [ ] Test all endpoints without token (should fail)
- [ ] Test with expired token (should fail)
- [ ] Test with invalid token (should fail)

### Authorization Tests
- [ ] Test permission enforcement on all endpoints
- [ ] Test SuperAdminGuard on terminate endpoint
- [ ] Test role-based access control

### Input Validation Tests
- [ ] Test SQL injection attempts
- [ ] Test XSS attempts in notes
- [ ] Test extremely long inputs
- [ ] Test special characters in inputs
- [ ] Test null/undefined values

### Audit Log Tests
- [ ] Verify all operations logged
- [ ] Verify admin details captured
- [ ] Verify termination logs immutable
- [ ] Verify no sensitive data in logs

## Monitoring Setup

### Logging
- [ ] Configure application logging
- [ ] Set up log aggregation
- [ ] Configure log retention
- [ ] Set up alerts for errors

### Metrics
- [ ] Track suspension operations
- [ ] Track termination operations
- [ ] Track auto-unsuspend success rate
- [ ] Track flag operations
- [ ] Track API response times
- [ ] Track BullMQ job completion rates

### Alerts
- [ ] Alert on failed auto-unsuspend jobs
- [ ] Alert on failed final settlement jobs
- [ ] Alert on high error rates
- [ ] Alert on permission violations
- [ ] Alert on termination operations

## Documentation Review

- [ ] Review LIFECYCLE-IMPLEMENTATION.md
- [ ] Review QUICK-START.md
- [ ] Review MERCHANT-LIFECYCLE-SUMMARY.md
- [ ] Review API examples in lifecycle-api-examples.http
- [ ] Review Swagger/OpenAPI documentation
- [ ] Update team documentation

## Deployment Steps

### Development Environment
1. [ ] Run migration
2. [ ] Restart application
3. [ ] Run smoke tests
4. [ ] Verify BullMQ dashboard
5. [ ] Test all endpoints manually

### Staging Environment
1. [ ] Deploy code
2. [ ] Run migration
3. [ ] Restart application
4. [ ] Run full test suite
5. [ ] Perform manual testing
6. [ ] Load testing
7. [ ] Security testing
8. [ ] Monitor for 24 hours

### Production Environment
1. [ ] Schedule maintenance window
2. [ ] Backup database
3. [ ] Deploy code
4. [ ] Run migration
5. [ ] Restart application
6. [ ] Run smoke tests
7. [ ] Monitor closely for 1 hour
8. [ ] Verify auto-unsuspend jobs working
9. [ ] Monitor for 24 hours
10. [ ] Document any issues

## Post-Deployment Verification

### Immediate Checks (First Hour)
- [ ] All endpoints responding
- [ ] No error spikes in logs
- [ ] Database queries performing well
- [ ] BullMQ jobs processing
- [ ] Email notifications sending

### 24-Hour Checks
- [ ] Auto-unsuspend jobs firing correctly
- [ ] No memory leaks
- [ ] No performance degradation
- [ ] Audit logs accumulating correctly
- [ ] No security incidents

### 7-Day Checks
- [ ] Review all operations performed
- [ ] Review audit logs
- [ ] Review error logs
- [ ] Review performance metrics
- [ ] Gather user feedback

## Rollback Plan

### If Issues Detected
1. [ ] Document the issue
2. [ ] Assess severity
3. [ ] If critical, initiate rollback:
   - [ ] Revert code deployment
   - [ ] Run migration rollback: `npm run migration:revert`
   - [ ] Restart application
   - [ ] Verify system stable
4. [ ] Investigate root cause
5. [ ] Fix and redeploy

### Rollback Commands
```bash
# Revert migration
npm run migration:revert

# Or manually
npx ts-node -r tsconfig-paths/register src/cli/migration-revert.ts
```

## Success Criteria

- [ ] All tests passing
- [ ] No critical bugs
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation complete
- [ ] Team trained
- [ ] Monitoring in place
- [ ] Rollback plan tested

## Sign-Off

- [ ] Development Lead: _______________
- [ ] QA Lead: _______________
- [ ] Security Lead: _______________
- [ ] DevOps Lead: _______________
- [ ] Product Owner: _______________

## Notes

Use this space to document any issues, decisions, or important information during deployment:

---
