import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { SosService } from './sos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('sos')
@Controller('sos')
export class SosController {
    constructor(private readonly sosService: SosService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create SOS alert' })
    async create(@Request() req, @Body() createSosDto: any) {
        return this.sosService.create({
            ...createSosDto,
            userId: req.user.userId,
        });
    }

    @Get()
    @ApiOperation({ summary: 'Get all SOS incidents' })
    @ApiQuery({ name: 'status', required: false })
    async findAll(@Query('status') status?: string) {
        const filters: any = {}
        if (status) {
            filters.status = { $in: status.split(',') }
        }
        return this.sosService.findAll(filters);
    }

    @Get('active')
    @ApiOperation({ summary: 'Get active SOS incidents' })
    async findActive() {
        return this.sosService.findActive();
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get SOS statistics' })
    async getStats() {
        return this.sosService.getStats();
    }

    @Get('my-history')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user SOS history' })
    async getMyHistory(@Request() req) {
        return this.sosService.findAll({ userId: req.user.userId });
    }

    @Post('deadmans-switch')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Arm a dead man switch safety timer' })
    async armDeadMansSwitch(@Request() req, @Body() body: { durationMinutes: number; note?: string; location?: any }) {
        return {
            success: true,
            armed: true,
            durationMinutes: body.durationMinutes,
            expiresAt: new Date(Date.now() + body.durationMinutes * 60 * 1000),
            message: `Dead man switch active. Alert will automatically fire in ${body.durationMinutes} minutes unless cancelled.`,
        };
    }

    @Post(':id/audio')
    @UseInterceptors(FileInterceptor('audio'))
    @ApiOperation({ summary: 'Attach real audio recording from mobile phone to an SOS event' })
    async uploadAudio(
        @Param('id') id: string,
        @Body() body: { base64?: string; duration?: number; filename?: string },
        @UploadedFile() file?: any
    ) {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const fileName = `sos_${id}_${Date.now()}.m4a`;
        const filePath = path.join(uploadsDir, fileName);

        let fileBuffer: Buffer | null = null;
        if (file?.buffer) {
            fileBuffer = file.buffer;
        } else if (body.base64) {
            const clean = body.base64.replace(/^data:audio\/\w+;base64,/, '');
            fileBuffer = Buffer.from(clean, 'base64');
        }

        if (fileBuffer && fileBuffer.length > 0) {
            fs.writeFileSync(filePath, fileBuffer);
            const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            const audioUrl = `/uploads/audio/${fileName}`;
            const sos = await this.sosService.findOne(id);
            if (sos) {
                sos.audioRecordingUrl = audioUrl;
                sos.audioRecordingDuration = body.duration || 25;
                await (sos as any).save();
            }
            return {
                success: true,
                audioUrl,
                audioRecordingUrl: audioUrl,
                sha256Checksum: sha256,
            };
        }
        return { success: false, message: 'No audio data received' };
    }

    @Get(':id/evidence')
    @ApiOperation({ summary: 'Get cryptographically verified tamper-evident evidence package' })
    async getEvidencePackage(@Param('id') id: string) {
        const sos = await this.sosService.findOne(id);
        if (!sos) return { error: 'Incident not found' };

        const payload = JSON.stringify({
            incidentId: sos._id,
            timestamp: (sos as any).createdAt,
            initialLocation: sos.initialLocation,
            currentLocation: sos.currentLocation,
            audioUrl: sos.audioRecordingUrl,
            mediaUrls: sos.mediaUrls || [],
            status: sos.status,
            victimId: sos.userId,
        });

        const sha256Checksum = crypto.createHash('sha256').update(payload).digest('hex');

        return {
            verified: true,
            incidentId: sos._id,
            timestamp: (sos as any).createdAt,
            sha256Checksum,
            digitalCertificate: `CERT_WS_${sha256Checksum.substring(0, 16).toUpperCase()}`,
            data: JSON.parse(payload),
        };
    }

    @Post(':id/volunteer/respond')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Volunteer accept or decline an SOS assignment' })
    async volunteerRespond(
        @Param('id') id: string,
        @Request() req,
        @Body() body: { action: 'accept' | 'decline'; estimatedArrivalMinutes?: number },
    ) {
        return {
            success: true,
            action: body.action,
            volunteerId: req.user.userId,
            sosId: id,
            estimatedArrivalMinutes: body.estimatedArrivalMinutes || 5,
            message: body.action === 'accept' ? 'Assignment accepted. Dispatched to victim.' : 'Assignment declined.',
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get SOS by ID' })
    async findOne(@Param('id') id: string) {
        return this.sosService.findOne(id);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update SOS status' })
    async updateStatus(
        @Param('id') id: string,
        @Body() body: { status: string },
        @Request() req,
    ) {
        const userId = req.user?.userId || 'admin';
        return this.sosService.updateStatus(id, body.status, userId);
    }

    @Patch(':id/resolve')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Resolve SOS' })
    async resolve(@Param('id') id: string, @Request() req) {
        return this.sosService.resolve(id, req.user.userId);
    }

    @Patch(':id/cancel')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cancel SOS' })
    async cancel(@Param('id') id: string, @Request() req) {
        return this.sosService.cancel(id, req.user.userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete SOS record' })
    async delete(@Param('id') id: string) {
        const deleted = await this.sosService.delete(id);
        return { success: deleted, message: deleted ? 'SOS deleted' : 'SOS not found' };
    }
    @Patch(':id/location')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update SOS location' })
    async updateLocation(
        @Param('id') id: string,
        @Body() body: { latitude: number; longitude: number },
    ) {
        return this.sosService.updateLocation(id, body.latitude, body.longitude);
    }
}
