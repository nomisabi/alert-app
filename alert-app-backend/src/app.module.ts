import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module.js';
import { AlertRulesModule } from './alert-rules/alert-rules.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    // Loads .env and validates it. isGlobal: ConfigService is injectable everywhere.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    HealthModule,
    AdminModule,
    CategoriesModule,
    AlertRulesModule,
    ChannelsModule,
  ],
})
export class AppModule {}
