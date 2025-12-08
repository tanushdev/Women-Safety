import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Volunteer, VolunteerSchema } from './schemas/volunteer.schema';
import { VolunteersService } from './volunteers.service';
import { VolunteersController } from './volunteers.controller';
import { GatewayModule } from '../../gateway/gateway.module';

import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Volunteer.name, schema: VolunteerSchema },
            { name: User.name, schema: UserSchema },
        ]),
        forwardRef(() => GatewayModule),
    ],
    controllers: [VolunteersController],
    providers: [VolunteersService],
    exports: [VolunteersService],
})
export class VolunteersModule { }
