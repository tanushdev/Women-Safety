import { Module } from '@nestjs/common';
import { SosService } from './sos.service';
import { SosController } from './sos.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Sos, SosSchema } from './schemas/sos.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Volunteer, VolunteerSchema } from '../volunteers/schemas/volunteer.schema';
import { GatewayModule } from '../../gateway/gateway.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Sos.name, schema: SosSchema },
            { name: User.name, schema: UserSchema },
            { name: Volunteer.name, schema: VolunteerSchema },
        ]),
        GatewayModule,
    ],
    controllers: [SosController],
    providers: [SosService],
    exports: [SosService],
})
export class SosModule { }
