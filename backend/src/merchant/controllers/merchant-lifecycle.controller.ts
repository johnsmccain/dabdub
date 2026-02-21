import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MerchantLifecycleService } from '../services/merchant-lifecycle.service';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { SuperAdminGuard } from '../guards/super-admin.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { RequirePermissionGuard } from '../../auth/guards/require-permission.guard';
import {
  SuspendMerchantDto,
  UnsuspendMerchantDto,
  TerminateMerchantDto,
  AddMerchantFlagDto,
  ResolveMerchantFlagDto,
  MerchantSuspensionResponseDto,
  MerchantTerminationResponseDto,
  MerchantFlagResponseDto,
} from '../dto/merchant-lifecycle.dto';

@ApiTags('Merchant Lifecycle')
@Controller('api/v1/merchants')
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class MerchantLifecycleController {
  constructor(
    private readonly lifecycleService: MerchantLifecycleService,
  ) {}

  @Post(':id/suspend')
  @UseGuards(RequirePermissionGuard)
  @RequirePermission('merchants:write')
  @ApiOperation({ summary: 'Suspend a merchant account' })
  @ApiParam({ name: 'id', description: 'Merchant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Merchant successfully suspended',
    type: MerchantSuspensionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid merchant status or validation error',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Merchant not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async suspendMerchant(
    @Param('id') merchantId: string,
    @Body() dto: SuspendMerchantDto,
    @Request() req: any,
  ): Promise<MerchantSuspensionResponseDto> {
    return this.lifecycleService.suspendMerchant(
      merchantId,
      dto,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }

  @Post(':id/unsuspend')
  @UseGuards(RequirePermissionGuard)
  @RequirePermission('merchants:write')
  @ApiOperation({ summary: 'Unsuspend a merchant account' })
  @ApiParam({ name: 'id', description: 'Merchant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Merchant successfully unsuspended',
    type: MerchantSuspensionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Merchant is not suspended',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Merchant or active suspension not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async unsuspendMerchant(
    @Param('id') merchantId: string,
    @Body() dto: UnsuspendMerchantDto,
    @Request() req: any,
  ): Promise<MerchantSuspensionResponseDto> {
    return this.lifecycleService.unsuspendMerchant(
      merchantId,
      dto,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }

  @Post(':id/terminate')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary: 'Terminate a merchant account permanently (SUPER_ADMIN only)',
  })
  @ApiParam({ name: 'id', description: 'Merchant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Merchant successfully terminated',
    type: MerchantTerminationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Confirmation required or merchant already terminated',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Merchant not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Super Admin role required',
  })
  async terminateMerchant(
    @Param('id') merchantId: string,
    @Body() dto: TerminateMerchantDto,
    @Request() req: any,
  ): Promise<MerchantTerminationResponseDto> {
    return this.lifecycleService.terminateMerchant(
      merchantId,
      dto,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }

  @Post(':id/flags')
  @UseGuards(RequirePermissionGuard)
  @RequirePermission('risk:manage')
  @ApiOperation({ summary: 'Add a compliance flag to a merchant' })
  @ApiParam({ name: 'id', description: 'Merchant ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Flag successfully added',
    type: MerchantFlagResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Merchant not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async addFlag(
    @Param('id') merchantId: string,
    @Body() dto: AddMerchantFlagDto,
    @Request() req: any,
  ): Promise<MerchantFlagResponseDto> {
    return this.lifecycleService.addFlag(
      merchantId,
      dto,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }

  @Get(':id/flags')
  @UseGuards(RequirePermissionGuard)
  @RequirePermission('risk:manage')
  @ApiOperation({ summary: 'Get all flags for a merchant' })
  @ApiParam({ name: 'id', description: 'Merchant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of merchant flags',
    type: [MerchantFlagResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Merchant not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async getFlags(
    @Param('id') merchantId: string,
  ): Promise<MerchantFlagResponseDto[]> {
    return this.lifecycleService.getFlags(merchantId);
  }

  @Post(':id/flags/:flagId/resolve')
  @UseGuards(RequirePermissionGuard)
  @RequirePermission('risk:manage')
  @ApiOperation({ summary: 'Resolve a merchant flag' })
  @ApiParam({ name: 'id', description: 'Merchant ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Flag successfully resolved',
    type: MerchantFlagResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Flag is already resolved',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Flag not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async resolveFlag(
    @Param('id') merchantId: string,
    @Param('flagId') flagId: string,
    @Body() dto: ResolveMerchantFlagDto,
    @Request() req: any,
  ): Promise<MerchantFlagResponseDto> {
    return this.lifecycleService.resolveFlag(
      merchantId,
      flagId,
      dto,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }
}
