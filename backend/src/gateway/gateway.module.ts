import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    providers: [EventsGateway],
    exports: [EventsGateway],
})
export class GatewayModule { }
