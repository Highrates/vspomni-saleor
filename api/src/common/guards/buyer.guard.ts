import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class BuyerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    if (user.role !== UserRole.USER) {
      throw new ForbiddenException('Buyer only');
    }
    return true;
  }
}
