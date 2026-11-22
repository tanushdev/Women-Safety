import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Journey, JourneySchema } from './schemas/journey.schema';
import { JourneyService } from './journey.service';
import { JourneyController } from './journey.controller';
import { GatewayModule } from '../../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Journey.name, schema: JourneySchema }]),
        GatewayModule,
        NotificationsModule,
    ],
    controllers: [JourneyController],
    providers: [JourneyService],
    exports: [JourneyService],
})
export class JourneyModule { }
