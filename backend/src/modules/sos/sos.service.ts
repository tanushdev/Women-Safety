import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Sos, SosDocument, SosStatus } from './schemas/sos.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { EventsGateway } from '../../gateway/events.gateway';

@Injectable()
export class SosService {
    private readonly logger = new Logger(SosService.name);

    constructor(
        @InjectModel(Sos.name) private sosModel: Model<SosDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private eventsGateway: EventsGateway,
        private configService: ConfigService,
    ) { }

    async create(createSosDto: any): Promise<SosDocument> {
        // Get user details first for emergency contacts and fallback location
        const user = await this.userModel.findById(createSosDto.userId);

        // Transform mobile app format to schema format
        const sosData: any = {
            userId: createSosDto.userId,
            triggerType: createSosDto.triggerType || 'button', // Default to button
            severity: createSosDto.severity || 'high',
            status: SosStatus.TRIGGERED,
        };

        // Handle location format from mobile app
        if (createSosDto.location && createSosDto.location.longitude && createSosDto.location.latitude &&
            createSosDto.location.longitude !== 0 && createSosDto.location.latitude !== 0) {
            sosData.initialLocation = {
                type: 'Point',
                coordinates: [
                    createSosDto.location.longitude,
                    createSosDto.location.latitude
                ],
            };
            this.logger.log(`SOS using provided location: [${createSosDto.location.longitude}, ${createSosDto.location.latitude}]`);
        } else if (createSosDto.initialLocation?.coordinates &&
            createSosDto.initialLocation.coordinates[0] !== 0 &&
            createSosDto.initialLocation.coordinates[1] !== 0) {
            sosData.initialLocation = createSosDto.initialLocation;
            this.logger.log(`SOS using initialLocation: ${JSON.stringify(createSosDto.initialLocation.coordinates)}`);
        } else if (user?.lastLocation?.coordinates &&
            user.lastLocation.coordinates[0] !== 0 &&
            user.lastLocation.coordinates[1] !== 0) {
            // Fallback to user's last known location
            sosData.initialLocation = {
                type: 'Point',
                coordinates: user.lastLocation.coordinates,
            };
            this.logger.warn(`SOS using fallback lastLocation for user ${createSosDto.userId}: ${JSON.stringify(user.lastLocation.coordinates)}`);
        } else {
            this.logger.error(`No valid location available for SOS from user ${createSosDto.userId}. User lastLocation: ${JSON.stringify(user?.lastLocation)}`);
        }

        this.logger.log(`Creating SOS for user ${createSosDto.userId} at location: ${JSON.stringify(sosData.initialLocation)}`);

        const sos = await this.sosModel.create(sosData);

        // Send alerts to emergency contacts (user already fetched above)
        if (user && user.emergencyContacts?.length > 0) {
            await this.alertEmergencyContacts(user, sos);
        }

        // Emit real-time event to admins
        this.eventsGateway.emitToAdmins('sos:new', {
            sosId: sos._id,
            userId: sos.userId,
            userName: user?.name,
            userPhone: user?.phone,
            triggerType: sos.triggerType,
            severity: sos.severity,
            location: sos.initialLocation,
            timestamp: sos.createdAt,
        });

        // Notify nearby volunteers
        this.eventsGateway.server.emit('volunteer:sos:nearby', {
            sosId: sos._id,
            userId: sos.userId,
            location: sos.initialLocation,
            severity: sos.severity,
            timestamp: sos.createdAt,
        });

        return sos;
    }

    /**
     * Alert all emergency contacts via SMS and WhatsApp
     */
    private async alertEmergencyContacts(user: UserDocument, sos: SosDocument) {
        const locationUrl = `https://www.google.com/maps?q=${sos.initialLocation?.coordinates?.[1]},${sos.initialLocation?.coordinates?.[0]}`;

        const message = `🚨 EMERGENCY ALERT 🚨\n\n` +
            `${user.name} needs help!\n\n` +
            `📍 Location: ${locationUrl}\n` +
            `📞 Phone: ${user.phone}\n` +
            `⏰ Time: ${new Date().toLocaleString()}\n\n` +
            `Please respond immediately or call emergency services.`;

        for (const contact of user.emergencyContacts) {
            if (!contact.notifyOnSOS) continue;

            try {
                // Send SMS
                await this.sendSMS(contact.phone, message);
                this.logger.log(`SMS alert sent to ${contact.name} (${contact.phone})`);

                // Send WhatsApp if enabled
                if (contact.whatsappEnabled) {
                    await this.sendWhatsApp(contact.phone, message);
                    this.logger.log(`WhatsApp alert sent to ${contact.name} (${contact.phone})`);
                }
            } catch (error) {
                this.logger.error(`Failed to alert ${contact.name}: ${error.message}`);
            }
        }

        // Send email if user has email
        if (user.email) {
            try {
                await this.sendEmail(user.email, 'SOS Alert Triggered', message);
            } catch (error) {
                this.logger.error(`Failed to send email: ${error.message}`);
            }
        }
    }

    /**
     * Send SMS notification
     */
    private async sendSMS(phone: string, message: string): Promise<void> {
        // In production, integrate with Twilio or similar
        // For now, log the message
        this.logger.log(`[SMS] To: ${phone}`);
        this.logger.log(`[SMS] Message: ${message}`);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Send WhatsApp notification
     */
    private async sendWhatsApp(phone: string, message: string): Promise<void> {
        // In production, integrate with WhatsApp Business API or Twilio
        // For now, log the message
        this.logger.log(`[WhatsApp] To: ${phone}`);
        this.logger.log(`[WhatsApp] Message: ${message}`);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Send Email notification
     */
    private async sendEmail(to: string, subject: string, body: string): Promise<void> {
        // In production, integrate with SendGrid, SES, etc.
        this.logger.log(`[Email] To: ${to}`);
        this.logger.log(`[Email] Subject: ${subject}`);
        this.logger.log(`[Email] Body: ${body}`);

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    async findAll(filters: any = {}): Promise<SosDocument[]> {
        return this.sosModel.find(filters)
            .populate('userId', 'name phone email')
            .sort({ createdAt: -1 })
            .limit(100);
    }

    async findActive(): Promise<SosDocument[]> {
        return this.sosModel.find({
            status: { $in: [SosStatus.TRIGGERED, SosStatus.IN_PROGRESS] }
        })
            .populate('userId', 'name phone email aadharNumber age')
            .sort({ createdAt: -1 });
    }

    async findOne(id: string): Promise<SosDocument | null> {
        return this.sosModel.findById(id)
            .populate('userId', 'name phone email aadharNumber age emergencyContacts');
    }

    async updateStatus(id: string, status: string, updatedBy: string): Promise<SosDocument | null> {
        const updateData: any = {
            status,
            updatedBy,
        };

        if (status === SosStatus.RESOLVED || status === SosStatus.CANCELLED) {
            updateData.resolvedBy = updatedBy;
            updateData.resolvedAt = new Date();
        }

        const sos = await this.sosModel.findByIdAndUpdate(id, updateData, { new: true });

        if (sos) {
            // Emit status change to all listeners
            this.eventsGateway.emitToSosRoom(id, 'sos:status:changed', {
                sosId: id,
                status,
                updatedBy,
                timestamp: new Date(),
            });

            this.eventsGateway.emitToAdmins('sos:updated', {
                sosId: id,
                status,
                updatedBy,
                timestamp: new Date(),
            });
        }

        return sos;
    }

    async cancel(id: string, userId: string): Promise<SosDocument | null> {
        return this.updateStatus(id, SosStatus.CANCELLED, userId);
    }

    async resolve(id: string, resolvedBy: string): Promise<SosDocument | null> {
        return this.updateStatus(id, SosStatus.RESOLVED, resolvedBy);
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.sosModel.findByIdAndDelete(id);
        return !!result;
    }

    /**
     * Get SOS statistics
     */
    async getStats() {
        const [total, active, resolved, cancelled] = await Promise.all([
            this.sosModel.countDocuments(),
            this.sosModel.countDocuments({ status: { $in: [SosStatus.TRIGGERED, SosStatus.IN_PROGRESS] } }),
            this.sosModel.countDocuments({ status: SosStatus.RESOLVED }),
            this.sosModel.countDocuments({ status: SosStatus.CANCELLED }),
        ]);

        return { total, active, resolved, cancelled };
    }
    async updateLocation(id: string, latitude: number, longitude: number): Promise<SosDocument | null> {
        const sos = await this.sosModel.findById(id);
        if (!sos) return null;

        // Update currentLocation in database
        sos.currentLocation = {
            type: 'Point',
            coordinates: [longitude, latitude],
        };
        await sos.save();

        // Emit to admin dashboard for real-time tracking
        this.eventsGateway.emitToAdmins('sos:location:updated', {
            sosId: id,
            latitude,
            longitude,
            timestamp: new Date(),
        });

        return sos;
    }
}
