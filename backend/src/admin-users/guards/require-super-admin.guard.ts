import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../database/entities/user.entity';
import { AdminRole } from '../../database/entities/admin-user.entity';

@Injectable()
export class RequireSuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    const role = user.role;
    const isSuperAdmin =
      role === UserRole.SUPER_ADMIN || role === AdminRole.SUPER_ADMIN;
    if (!isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }
    return true;
  }
}
