import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { Sos, SosSchema } from '../sos/schemas/sos.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Sos.name, schema: SosSchema }]),
    ],
    controllers: [MediaController],
    providers: [MediaService],
    exports: [MediaService],
})
export class MediaModule { }
