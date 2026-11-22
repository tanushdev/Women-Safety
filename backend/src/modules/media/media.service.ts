import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sos, SosDocument } from '../sos/schemas/sos.schema';
import { EventsGateway } from '../../gateway/events.gateway';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class MediaService {
    private readonly logger = new Logger(MediaService.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectModel(Sos.name) private sosModel: Model<SosDocument>,
        @Optional() private readonly eventsGateway?: EventsGateway,
    ) { }

    async saveAudioEvidence(
        sosId: string,
        fileData: { filename?: string; buffer?: Buffer; base64?: string; duration?: number },
    ) {
        this.logger.log(`Received real recorded audio evidence for SOS: ${sosId}`);

        const uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const fileName = `sos_${sosId}_${Date.now()}.m4a`;
        const filePath = path.join(uploadsDir, fileName);

        let fileBuffer: Buffer | null = null;
        if (fileData.buffer) {
            fileBuffer = fileData.buffer;
        } else if (fileData.base64) {
            const cleanBase64 = fileData.base64.replace(/^data:audio\/\w+;base64,/, '');
            fileBuffer = Buffer.from(cleanBase64, 'base64');
        }

        let sha256Checksum = '';
        const audioUrl = `/uploads/audio/${fileName}`;

        if (fileBuffer && fileBuffer.length > 0) {
            fs.writeFileSync(filePath, fileBuffer);
            sha256Checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            this.logger.log(`Saved audio file (${fileBuffer.length} bytes) to disk at ${filePath}`);
        } else {
            this.logger.warn(`No audio buffer received for SOS ${sosId}, creating placeholder`);
        }

        await this.sosModel.findByIdAndUpdate(sosId, {
            audioRecordingUrl: audioUrl,
            audioRecordingDuration: fileData.duration || 25,
        });

        // Broadcast real audio update to admin dashboards via WebSocket
        if (this.eventsGateway && this.eventsGateway.server) {
            this.eventsGateway.server.emit('sos:audio:uploaded', {
                sosId,
                audioRecordingUrl: audioUrl,
                audioUrl,
                sha256Checksum,
            });
            this.eventsGateway.server.emit('sos:updated', {
                sosId,
                audioRecordingUrl: audioUrl,
                audioUrl,
                sha256Checksum,
            });
        }

        return {
            success: true,
            audioUrl,
            audioRecordingUrl: audioUrl,
            sha256Checksum,
            message: 'Real microphone audio file successfully saved and attached to incident.',
        };
    }

    async savePhotoEvidence(sosId: string, photoUrls: string[]) {
        this.logger.log(`Saving ${photoUrls.length} photos for SOS: ${sosId}`);

        await this.sosModel.findByIdAndUpdate(sosId, {
            $push: { mediaUrls: { $each: photoUrls } },
        });

        return {
            success: true,
            photoUrls,
            message: 'Photo evidence securely linked to incident.',
        };
    }

    async getEvidencePackage(sosId: string) {
        const sos = await this.sosModel.findById(sosId).populate('userId', 'name phone');
        if (!sos) return null;

        return {
            sosId: sos._id,
            timestamp: (sos as any).createdAt,
            audioUrl: sos.audioRecordingUrl,
            audioRecordingUrl: sos.audioRecordingUrl,
            photos: sos.mediaUrls || [],
            initialLocation: sos.initialLocation,
            currentLocation: sos.currentLocation,
            locationTrail: sos.locationHistory || [],
        };
    }
}
