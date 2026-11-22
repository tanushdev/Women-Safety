import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Sos, SosDocument, SosStatus } from './schemas/sos.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Volunteer, VolunteerDocument } from '../volunteers/schemas/volunteer.schema';
import { EventsGateway } from '../../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SosService {
    private readonly logger = new Logger(SosService.name);

    constructor(
        @InjectModel(Sos.name) private sosModel: Model<SosDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Volunteer.name) private volunteerModel: Model<VolunteerDocument>,
        private eventsGateway: EventsGateway,
        private configService: ConfigService,
        private notificationsService: NotificationsService,
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

        // Notify nearby volunteers with proximity filtering
        const coords = sos.initialLocation?.coordinates;
        if (coords && coords.length === 2 && coords[0] !== 0 && coords[1] !== 0) {
            try {
                const nearbyVolunteers = await this.volunteerModel.find({
                    'currentLocation.coordinates': {
                        $nearSphere: {
                            $geometry: {
                                type: 'Point',
                                coordinates: coords,
                            },
                            $maxDistance: 5000, // 5km radius
                        },
                    },
                    status: { $in: ['available', 'busy'] },
                    isActive: { $ne: false },
                }).limit(20);

                if (nearbyVolunteers.length > 0) {
                    this.logger.log(`Found ${nearbyVolunteers.length} nearby volunteers within 5km for SOS ${sos._id}`);
                    for (const v of nearbyVolunteers) {
                        this.eventsGateway.server.to(`volunteer:${v._id}`).emit('volunteer:sos:nearby', {
                            sosId: sos._id,
                            userId: sos.userId,
                            location: sos.initialLocation,
                            severity: sos.severity,
                            timestamp: sos.createdAt,
                        });
                    }
                }
            } catch (err: any) {
                this.logger.error(`Error querying nearby volunteers: ${err?.message}`);
            }
        }

        // Emit broadcast as well so all active listeners receive it
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
        await this.notificationsService.sendSMS(phone, message);
    }

    /**
     * Send WhatsApp notification
     */
    private async sendWhatsApp(phone: string, message: string): Promise<void> {
        await this.notificationsService.sendWhatsApp(phone, message);
    }

    /**
     * Send Email notification
     */
    private async sendEmail(to: string, subject: string, body: string): Promise<void> {
        await this.notificationsService.sendEmail(to, subject, body);
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

    async updateAudioRecording(id: string, audioUrl: string, sha256Checksum: string, duration: number): Promise<SosDocument | null> {
        const sos = await this.sosModel.findByIdAndUpdate(id, {
            audioRecordingUrl: audioUrl,
            audioRecordingDuration: duration,
        }, { new: true });

        if (this.eventsGateway && this.eventsGateway.server) {
            this.eventsGateway.server.emit('sos:audio:uploaded', {
                sosId: id,
                audioRecordingUrl: audioUrl,
                audioUrl,
                sha256Checksum,
            });
            this.eventsGateway.server.emit('sos:updated', {
                sosId: id,
                audioRecordingUrl: audioUrl,
                audioUrl,
                sha256Checksum,
            });
        }

        return sos;
    }
}
