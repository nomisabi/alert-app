import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AdminGuard, AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

// @Global: every module can use AuthGuard/AdminGuard (they need AuthService) without importing AuthModule
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AdminGuard],
  exports: [AuthService, AuthGuard, AdminGuard],
})
export class AuthModule {}
