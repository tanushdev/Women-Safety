import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UploadedFile,
    UseInterceptors,
    Request
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
    constructor(private readonly mediaService: MediaService) { }

    @Post('evidence/:sosId/audio')
    @UseInterceptors(FileInterceptor('audio'))
    @ApiConsumes('multipart/form-data', 'application/json')
    @ApiOperation({ summary: 'Attach real recorded audio file to an active SOS' })
    async uploadAudio(
        @Param('sosId') sosId: string,
        @Body() body: { base64?: string; duration?: number; filename?: string },
        @UploadedFile() file?: any
    ) {
        return this.mediaService.saveAudioEvidence(sosId, {
            filename: body.filename || file?.originalname,
            buffer: file?.buffer,
            base64: body.base64,
            duration: body.duration || 25,
        });
    }

    @Post('evidence/:sosId/photos')
    @ApiOperation({ summary: 'Attach photo evidence URLs to an active SOS' })
    async uploadPhotos(@Param('sosId') sosId: string, @Body() body: { photoUrls: string[] }) {
        return this.mediaService.savePhotoEvidence(sosId, body.photoUrls || []);
    }

    @Get('evidence/:sosId')
    @ApiOperation({ summary: 'Get evidence package for an SOS event' })
    async getEvidence(@Param('sosId') sosId: string) {
        return this.mediaService.getEvidencePackage(sosId);
    }
}
