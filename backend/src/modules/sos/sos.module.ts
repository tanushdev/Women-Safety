import { Module } from '@nestjs/common';
import { SosService } from './sos.service';
import { SosController } from './sos.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Sos, SosSchema } from './schemas/sos.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { GatewayModule } from '../../gateway/gateway.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Sos.name, schema: SosSchema },
            { name: User.name, schema: UserSchema },
        ]),
        GatewayModule,
    ],
    controllers: [SosController],
    providers: [SosService],
    exports: [SosService],
})
export class SosModule { }
