import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Volunteer, VolunteerDocument, VolunteerStatus, VolunteerVerificationStatus } from './schemas/volunteer.schema';
import { EventsGateway } from '../../gateway/events.gateway';

import { User, UserDocument, UserRole } from '../users/schemas/user.schema';

export interface RegisterVolunteerDto {
    userId: string;
    governmentId: string; // Required unique ID like PLC4321
    skills?: string[];
    languages?: string[];
    maxResponseDistance?: number;
    bio?: string;
}

@Injectable()
export class VolunteersService {
    private readonly logger = new Logger(VolunteersService.name);

    constructor(
        @InjectModel(Volunteer.name) private volunteerModel: Model<VolunteerDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private eventsGateway: EventsGateway,
    ) { }

    /**
     * Register a new volunteer (pending approval)
     */
    async register(dto: RegisterVolunteerDto): Promise<VolunteerDocument> {
        // Check if user already registered
        const existingUser = await this.volunteerModel.findOne({ userId: dto.userId });
        if (existingUser) {
            throw new BadRequestException('User is already registered as volunteer');
        }

        // Check if government ID already exists
        const existingGovId = await this.volunteerModel.findOne({ governmentId: dto.governmentId });
        if (existingGovId) {
            throw new BadRequestException('This Government ID is already registered');
        }

        const volunteer = await this.volunteerModel.create({
            userId: new Types.ObjectId(dto.userId),
            governmentId: dto.governmentId,
            status: VolunteerStatus.OFFLINE,
            verificationStatus: VolunteerVerificationStatus.PENDING,
            skills: dto.skills || [],
            languages: dto.languages || [],
            maxResponseDistance: dto.maxResponseDistance || 5000,
            bio: dto.bio,
            isActive: false, // Not active until approved
        });

        this.logger.log(`New volunteer registered: ${dto.governmentId}`);
        return volunteer;
    }

    /**
     * Approve a volunteer (Admin only)
     */
    async approve(id: string): Promise<VolunteerDocument> {
        const volunteer = await this.volunteerModel.findByIdAndUpdate(
            id,
            {
                verificationStatus: VolunteerVerificationStatus.VERIFIED,
                isActive: true,
            },
            { new: true },
        ).populate('userId', 'name phone email');

        if (!volunteer) {
            throw new NotFoundException('Volunteer not found');
        }

        this.logger.log(`Volunteer approved: ${id}`);

        // Notify the volunteer they've been approved
        // After populate, userId is an object with _id field
        const userIdStr = (volunteer.userId as any)?._id?.toString() || volunteer.userId?.toString();
        this.logger.log(`User ID for role update: ${userIdStr}`);

        if (userIdStr) {
            // Update the user's role to VOLUNTEER
            const updatedUser = await this.userModel.findByIdAndUpdate(
                userIdStr,
                { role: UserRole.VOLUNTEER },
                { new: true }
            );
            this.logger.log(`User role updated: ${updatedUser?.role}`);

            this.eventsGateway.emitToUser(userIdStr, 'volunteer:approved', {
                message: 'You have been approved as a volunteer!',
            });
        }

        return volunteer;
    }

    /**
     * Reject a volunteer (Admin only)
     */
    async reject(id: string, reason?: string): Promise<VolunteerDocument> {
        const volunteer = await this.volunteerModel.findByIdAndUpdate(
            id,
            {
                verificationStatus: VolunteerVerificationStatus.REJECTED,
                isActive: false,
                'metadata.rejectionReason': reason,
            },
            { new: true },
        ).populate('userId', 'name phone email');

        if (!volunteer) {
            throw new NotFoundException('Volunteer not found');
        }

        this.logger.log(`Volunteer rejected: ${id}`);
        return volunteer;
    }

    /**
     * Get all volunteers with filters
     */
    async findAll(filters?: {
        status?: VolunteerStatus;
        verificationStatus?: VolunteerVerificationStatus;
        isActive?: boolean;
    }): Promise<VolunteerDocument[]> {
        const query: any = {};

        if (filters?.status) query.status = filters.status;
        if (filters?.verificationStatus) query.verificationStatus = filters.verificationStatus;
        if (filters?.isActive !== undefined) query.isActive = filters.isActive;

        return this.volunteerModel.find(query)
            .populate('userId', 'name phone email')
            .sort({ createdAt: -1 })
            .exec();
    }

    /**
     * Get volunteer by ID
     */
    async findById(id: string): Promise<VolunteerDocument> {
        const volunteer = await this.volunteerModel.findById(id)
            .populate('userId', 'name phone email');

        if (!volunteer) {
            throw new NotFoundException('Volunteer not found');
        }
        return volunteer;
    }

    /**
     * Get volunteer by user ID
     */
    async findByUserId(userId: string): Promise<VolunteerDocument | null> {
        return this.volunteerModel.findOne({ userId: new Types.ObjectId(userId) })
            .populate('userId', 'name phone email');
    }

    /**
     * Update volunteer location
     */
    async updateLocation(
        userId: string,
        latitude: number,
        longitude: number,
    ): Promise<VolunteerDocument | null> {
        const volunteer = await this.volunteerModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            {
                currentLocation: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
                lastLocationUpdate: new Date(),
            },
            { new: true },
        );

        return volunteer;
    }

    /**
     * Update volunteer status
     */
    async updateStatus(userId: string, status: VolunteerStatus): Promise<VolunteerDocument | null> {
        return this.volunteerModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            { status },
            { new: true },
        );
    }

    /**
     * Find nearby volunteers for SOS alert
     */
    async findNearby(
        latitude: number,
        longitude: number,
        radiusMeters: number = 5000,
    ): Promise<VolunteerDocument[]> {
        return this.volunteerModel.find({
            isActive: true,
            verificationStatus: VolunteerVerificationStatus.VERIFIED,
            status: { $in: [VolunteerStatus.AVAILABLE] },
            'currentLocation.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                    $maxDistance: radiusMeters,
                },
            },
        }).populate('userId', 'name phone').exec();
    }

    /**
     * Alert nearby volunteers about SOS
     */
    async alertNearbyVolunteers(sosId: string, latitude: number, longitude: number): Promise<number> {
        const nearbyVolunteers = await this.findNearby(latitude, longitude, 5000);

        for (const volunteer of nearbyVolunteers) {
            this.eventsGateway.emitToUser(volunteer.userId.toString(), 'sos:nearby', {
                sosId,
                message: 'Someone nearby needs help!',
                location: { latitude, longitude },
                distance: 'Within 5km',
            });
        }

        this.logger.log(`Alerted ${nearbyVolunteers.length} volunteers for SOS ${sosId}`);
        return nearbyVolunteers.length;
    }

    /**
     * Get volunteer statistics
     */
    async getStats() {
        const [total, pending, verified, available] = await Promise.all([
            this.volunteerModel.countDocuments(),
            this.volunteerModel.countDocuments({ verificationStatus: VolunteerVerificationStatus.PENDING }),
            this.volunteerModel.countDocuments({ verificationStatus: VolunteerVerificationStatus.VERIFIED }),
            this.volunteerModel.countDocuments({
                status: VolunteerStatus.AVAILABLE,
                verificationStatus: VolunteerVerificationStatus.VERIFIED,
            }),
        ]);

        return { total, pending, verified, available };
    }

    /**
     * Delete volunteer
     */
    async delete(id: string): Promise<boolean> {
        const result = await this.volunteerModel.findByIdAndDelete(id);
        return !!result;
    }
}
