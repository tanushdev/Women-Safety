import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import crypto from 'crypto';
import { Journey, JourneyDocument } from './schemas/journey.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../../gateway/events.gateway';

export interface StartJourneyDto {
    destinationName: string;
    destinationCoordinates?: [number, number];
    currentLocation: [number, number];
    etaMinutes: number;
    guardianPhones?: string[];
    batteryLevel?: number;
}

@Injectable()
export class JourneyService {
    private readonly logger = new Logger(JourneyService.name);

    constructor(
        @InjectModel(Journey.name) private journeyModel: Model<JourneyDocument>,
        private notificationsService: NotificationsService,
        private eventsGateway: EventsGateway,
    ) { }

    async startJourney(userId: string, dto: StartJourneyDto) {
        const shareToken = `tr_${crypto.randomBytes(8).toString('hex')}`;
        const eta = new Date(Date.now() + (dto.etaMinutes || 30) * 60 * 1000);

        const journey = await this.journeyModel.create({
            userId: new Types.ObjectId(userId),
            destinationName: dto.destinationName,
            destinationCoordinates: dto.destinationCoordinates ? {
                type: 'Point',
                coordinates: dto.destinationCoordinates,
            } : undefined,
            currentLocation: {
                type: 'Point',
                coordinates: dto.currentLocation,
            },
            eta,
            status: 'active',
            shareToken,
            guardianPhones: dto.guardianPhones || [],
            batteryLevel: dto.batteryLevel || 95,
        });

        const trackingUrl = `https://womensafety.live/track/${shareToken}`;

        // Notify guardians via SMS with live tracking link
        if (dto.guardianPhones && dto.guardianPhones.length > 0) {
            const message = `🛡️ Live Journey Alert: Safe trip started to ${dto.destinationName}. Expected arrival: ${eta.toLocaleTimeString()}. Track live location: ${trackingUrl}`;
            for (const phone of dto.guardianPhones) {
                await this.notificationsService.sendSMS(phone, message);
            }
        }

        return {
            journeyId: journey._id,
            shareToken,
            trackingUrl,
            eta,
            status: 'active',
        };
    }

    async updateLocation(shareToken: string, coordinates: [number, number], batteryLevel?: number) {
        const journey = await this.journeyModel.findOneAndUpdate(
            { shareToken, status: 'active' },
            {
                currentLocation: { type: 'Point', coordinates },
                ...(batteryLevel ? { batteryLevel } : {}),
            },
            { new: true },
        );

        if (!journey) throw new NotFoundException('Journey not found or already completed');

        // Broadcast to WebSocket room for tracking
        this.eventsGateway.server.to(`track:${shareToken}`).emit('journey:location:update', {
            coordinates,
            batteryLevel: journey.batteryLevel,
            updatedAt: new Date(),
        });

        return { success: true };
    }

    async markArrived(shareToken: string, userId?: string) {
        const journey = await this.journeyModel.findOneAndUpdate(
            { shareToken },
            { status: 'completed', arrivedAt: new Date() },
            { new: true },
        );

        if (!journey) throw new NotFoundException('Journey not found');

        // Notify guardians of safe arrival
        if (journey.guardianPhones && journey.guardianPhones.length > 0) {
            const message = `✅ Safe Arrival Confirmed: Reached ${journey.destinationName} safely!`;
            for (const phone of journey.guardianPhones) {
                await this.notificationsService.sendSMS(phone, message);
            }
        }

        return { success: true, message: 'Safely arrived! Guardians have been notified.' };
    }

    async getPublicTracking(shareToken: string) {
        const journey = await this.journeyModel.findOne({ shareToken }).populate('userId', 'name');
        if (!journey) throw new NotFoundException('Tracking link expired or invalid');

        return {
            userName: (journey.userId as any)?.name || 'Protected User',
            destination: journey.destinationName,
            status: journey.status,
            currentLocation: journey.currentLocation?.coordinates,
            eta: journey.eta,
            batteryLevel: journey.batteryLevel,
            updatedAt: (journey as any).updatedAt,
        };
    }
}
