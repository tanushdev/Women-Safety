import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Sos, SosSchema } from '../sos/schemas/sos.schema';
import { Zone, ZoneSchema } from '../zones/schemas/zone.schema';
import { Volunteer, VolunteerSchema } from '../volunteers/schemas/volunteer.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Sos.name, schema: SosSchema },
            { name: Zone.name, schema: ZoneSchema },
            { name: Volunteer.name, schema: VolunteerSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [AnalyticsController],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }
