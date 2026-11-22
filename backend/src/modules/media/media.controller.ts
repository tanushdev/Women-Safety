import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('media')
@Controller('media')
export class MediaController {
    constructor(private readonly mediaService: MediaService) { }

    @Post('evidence/:sosId/audio')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Attach audio evidence to an active SOS' })
    async uploadAudio(@Param('sosId') sosId: string, @Body() body: { base64?: string; duration?: number }) {
        return this.mediaService.saveAudioEvidence(sosId, body);
    }

    @Post('evidence/:sosId/photos')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
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
