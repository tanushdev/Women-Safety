import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

    async findById(id: string): Promise<UserDocument> {
        const user = await this.userModel.findById(id).select('-password -refreshToken');
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async findAll(): Promise<UserDocument[]> {
        return this.userModel.find().select('-password -refreshToken');
    }

    async findByPhone(phone: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ phone });
    }

    async updateProfile(userId: string, updateData: Partial<User>) {
        // Only allow updating specific fields
        const allowedFields = ['name', 'email', 'age', 'aadharNumber', 'profilePhoto', 'settings'];
        const sanitizedData: any = {};

        for (const field of allowedFields) {
            if (updateData[field as keyof User] !== undefined) {
                sanitizedData[field] = updateData[field as keyof User];
            }
        }

        const user = await this.userModel.findByIdAndUpdate(
            userId,
            sanitizedData,
            { new: true }
        ).select('-password -refreshToken');

        if (!user) {
            throw new NotFoundException('User not found');
        }

        this.logger.log(`Profile updated for user ${userId}`);
        return user;
    }

    async updateLocation(userId: string, coordinates: [number, number]) {
        return this.userModel.findByIdAndUpdate(
            userId,
            {
                lastLocation: {
                    type: 'Point',
                    coordinates,
                },
                lastLocationUpdate: new Date(),
            },
            { new: true },
        ).select('-password -refreshToken');
    }

    async updateEmergencyContacts(userId: string, contacts: any[]) {
        // Validate and sanitize contacts
        const sanitizedContacts = contacts.map(contact => ({
            name: contact.name,
            phone: contact.phone,
            relationship: contact.relationship || '',
            notifyOnSOS: contact.notifyOnSOS !== false,
            whatsappEnabled: contact.whatsappEnabled || false,
        }));

        const user = await this.userModel.findByIdAndUpdate(
            userId,
            { emergencyContacts: sanitizedContacts },
            { new: true },
        ).select('-password -refreshToken');

        if (!user) {
            throw new NotFoundException('User not found');
        }

        this.logger.log(`Emergency contacts updated for user ${userId}: ${contacts.length} contacts`);
        return user;
    }

    async addEmergencyContact(userId: string, contact: any) {
        const sanitizedContact = {
            name: contact.name,
            phone: contact.phone,
            relationship: contact.relationship || '',
            notifyOnSOS: contact.notifyOnSOS !== false,
            whatsappEnabled: contact.whatsappEnabled || false,
        };

        return this.userModel.findByIdAndUpdate(
            userId,
            { $push: { emergencyContacts: sanitizedContact } },
            { new: true },
        ).select('-password -refreshToken');
    }

    async removeEmergencyContact(userId: string, contactPhone: string) {
        return this.userModel.findByIdAndUpdate(
            userId,
            { $pull: { emergencyContacts: { phone: contactPhone } } },
            { new: true },
        ).select('-password -refreshToken');
    }

    async deleteUser(userId: string): Promise<void> {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Delete user
        await this.userModel.findByIdAndDelete(userId);

        this.logger.log(`User ${userId} and all associated data deleted`);
    }

    async findNearbyVolunteers(coordinates: [number, number], radiusKm: number = 5) {
        return this.userModel.find({
            role: 'volunteer',
            status: 'active',
            'lastLocation.coordinates': {
                $nearSphere: {
                    $geometry: {
                        type: 'Point',
                        coordinates,
                    },
                    $maxDistance: radiusKm * 1000, // Convert to meters
                },
            },
        }).select('name phone lastLocation');
    }
}
