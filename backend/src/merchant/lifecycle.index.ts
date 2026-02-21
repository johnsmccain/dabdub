/**
 * Merchant Lifecycle Management - Public API
 * 
 * This file exports all public types, DTOs, and services for merchant lifecycle management.
 */

// DTOs
export {
  SuspendMerchantDto,
  UnsuspendMerchantDto,
  TerminateMerchantDto,
  AddMerchantFlagDto,
  ResolveMerchantFlagDto,
  MerchantSuspensionResponseDto,
  MerchantTerminationResponseDto,
  MerchantFlagResponseDto,
} from './dto/merchant-lifecycle.dto';

// Entities
export {
  MerchantSuspension,
  SuspensionReason,
} from './entities/merchant-suspension.entity';

export {
  MerchantTermination,
  TerminationReason,
} from './entities/merchant-termination.entity';

export {
  MerchantFlag,
  FlagType,
  FlagSeverity,
} from './entities/merchant-flag.entity';

// Services
export { MerchantLifecycleService } from './services/merchant-lifecycle.service';

// Guards
export { SuperAdminGuard } from './guards/super-admin.guard';

// Controllers
export { MerchantLifecycleController } from './controllers/merchant-lifecycle.controller';

// Processors
export { MerchantLifecycleProcessor } from './processors/merchant-lifecycle.processor';
