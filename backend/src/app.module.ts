import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';

// Core Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SosModule } from './modules/sos/sos.module';
import { VolunteersModule } from './modules/volunteers/volunteers.module';
import { ZonesModule } from './modules/zones/zones.module';
import { MediaModule } from './modules/media/media.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JourneyModule } from './modules/journey/journey.module';
import { ReportsModule } from './modules/reports/reports.module';
import { GatewayModule } from './gateway/gateway.module';

// Common
import { LoggerModule } from './common/logger/logger.module';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        // Database
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                uri: configService.get<string>('MONGODB_URI'),
                retryAttempts: 3,
                retryDelay: 1000,
            }),
            inject: [ConfigService],
        }),

        // Redis & Bull Queue
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                redis: {
                    host: configService.get<string>('REDIS_HOST'),
                    port: configService.get<number>('REDIS_PORT'),
                    password: configService.get<string>('REDIS_PASSWORD'),
                    db: configService.get<number>('REDIS_DB', 0),
                },
            }),
            inject: [ConfigService],
        }),

        // Rate Limiting
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ([{
                ttl: configService.get<number>('RATE_LIMIT_TTL', 60) * 1000,
                limit: configService.get<number>('RATE_LIMIT_MAX', 100),
            }]),
            inject: [ConfigService],
        }),

        // Feature Modules
        LoggerModule,
        AuthModule,
        UsersModule,
        SosModule,
        VolunteersModule,
        ZonesModule,
        MediaModule,
        AdminModule,
        AnalyticsModule,
        NotificationsModule,
        JourneyModule,
        ReportsModule,
        GatewayModule,
    ],
})
export class AppModule { }
