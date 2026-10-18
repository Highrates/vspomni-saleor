import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '../decorators/current-user.decorator';

/** Только суперадмин (ADMIN). Вешать после AdminGuard. */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Только суперадмин');
    }
    return true;
  }
}
