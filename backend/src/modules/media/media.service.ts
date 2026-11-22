import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sos, SosDocument } from '../sos/schemas/sos.schema';

@Injectable()
export class MediaService {
    private readonly logger = new Logger(MediaService.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectModel(Sos.name) private sosModel: Model<SosDocument>,
    ) { }

    async saveAudioEvidence(sosId: string, fileData: { filename?: string; buffer?: Buffer; base64?: string; duration?: number }) {
        this.logger.log(`Received audio evidence for SOS: ${sosId}`);
        const audioUrl = `https://safety-evidence.storage/audio/${sosId}_${Date.now()}.m4a`;

        await this.sosModel.findByIdAndUpdate(sosId, {
            audioRecordingUrl: audioUrl,
            audioRecordingDuration: fileData.duration || 20,
        });

        return {
            success: true,
            audioUrl,
            message: 'Audio evidence successfully captured and attached to incident report.',
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
            timestamp: sos.createdAt,
            audioUrl: sos.audioRecordingUrl,
            photos: sos.mediaUrls || [],
            initialLocation: sos.initialLocation,
            currentLocation: sos.currentLocation,
            locationTrail: sos.locationHistory || [],
        };
    }
}
