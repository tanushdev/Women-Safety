import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';
import { Zone, ZoneSchema } from '../zones/schemas/zone.schema';
import { Volunteer, VolunteerSchema } from '../volunteers/schemas/volunteer.schema';
import { Sos, SosSchema } from '../sos/schemas/sos.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Zone.name, schema: ZoneSchema },
            { name: Volunteer.name, schema: VolunteerSchema },
            { name: Sos.name, schema: SosSchema },
        ]),
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
