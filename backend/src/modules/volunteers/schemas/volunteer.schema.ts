import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type VolunteerDocument = Volunteer & Document;

export enum VolunteerStatus {
    AVAILABLE = 'available',
    BUSY = 'busy',
    OFFLINE = 'offline',
    ON_MISSION = 'on_mission',
}

export enum VolunteerVerificationStatus {
    PENDING = 'pending',
    VERIFIED = 'verified',
    REJECTED = 'rejected',
}

class Location {
    @ApiProperty({ example: 'Point' })
    @Prop({ type: String, enum: ['Point'], default: 'Point' })
    type: string;

    @ApiProperty({ example: [77.5946, 12.9716] })
    @Prop({ type: [Number], index: '2dsphere' })
    coordinates: number[]; // [longitude, latitude]
}

class VolunteerStats {
    @ApiProperty({ example: 25 })
    @Prop({ default: 0 })
    totalMissions: number;

    @ApiProperty({ example: 23 })
    @Prop({ default: 0 })
    completed: number;

    @ApiProperty({ example: 1 })
    @Prop({ default: 0 })
    declined: number;

    @ApiProperty({ example: 1 })
    @Prop({ default: 0 })
    cancelled: number;

    @ApiProperty({ example: 4.8 })
    @Prop({ default: 0 })
    averageRating: number;

    @ApiProperty({ example: 15.5 })
    @Prop()
    averageResponseTime?: number; // minutes

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    @Prop()
    lastMissionAt?: Date;
}

class Availability {
    @ApiProperty({ example: true })
    @Prop({ default: true })
    monday: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    tuesday: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    wednesday: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    thursday: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    friday: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    saturday: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    sunday: boolean;

    @ApiProperty({ example: '09:00-22:00' })
    @Prop()
    preferredHours?: string;
}

@Schema({ timestamps: true })
export class Volunteer {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
    userId: Types.ObjectId;

    @ApiProperty({ example: 'PLC4321' })
    @Prop({ required: true, unique: true, index: true })
    governmentId: string; // Unique ID like PLC4321, GOV1234, etc.

    @ApiProperty({ enum: VolunteerStatus, example: VolunteerStatus.AVAILABLE })
    @Prop({ type: String, enum: VolunteerStatus, default: VolunteerStatus.OFFLINE, index: true })
    status: VolunteerStatus;

    @ApiProperty({ enum: VolunteerVerificationStatus, example: VolunteerVerificationStatus.VERIFIED })
    @Prop({
        type: String,
        enum: VolunteerVerificationStatus,
        default: VolunteerVerificationStatus.PENDING,
        index: true,
    })
    verificationStatus: VolunteerVerificationStatus;

    @ApiProperty({ type: Location })
    @Prop({ type: Location })
    currentLocation?: Location;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    @Prop()
    lastLocationUpdate?: Date;

    @ApiProperty({ example: 5000 })
    @Prop({ default: 5000 })
    maxResponseDistance: number; // meters

    @ApiProperty({ example: ['first_aid', 'self_defense', 'counseling'] })
    @Prop({ type: [String], default: [] })
    skills: string[];

    @ApiProperty({ example: 'Police Certificate ID: ABC123' })
    @Prop()
    backgroundCheckId?: string;

    @ApiProperty({ example: '2024-01-10T10:30:00Z' })
    @Prop()
    backgroundCheckDate?: Date;

    @ApiProperty({ example: 'https://s3.../certificate.pdf' })
    @Prop()
    certificateUrl?: string;

    @ApiProperty({ example: '+919876543210' })
    @Prop()
    emergencyContact?: string;

    @ApiProperty({ type: VolunteerStats })
    @Prop({ type: VolunteerStats, default: () => ({}) })
    stats: VolunteerStats;

    @ApiProperty({ type: Availability })
    @Prop({ type: Availability, default: () => ({}) })
    availability: Availability;

    @ApiProperty({ example: 'Koramangala, Bangalore' })
    @Prop()
    preferredArea?: string;

    @ApiProperty({ example: ['Koramangala', 'Indiranagar', 'HSR Layout'] })
    @Prop({ type: [String], default: [] })
    coveredAreas: string[];

    @ApiProperty({ example: 'car' })
    @Prop({ type: String, enum: ['walk', 'bike', 'car', 'public_transport'] })
    transportMode?: string;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    isActive: boolean;

    @ApiProperty({ example: '507f1f77bcf86cd799439012' })
    @Prop({ type: Types.ObjectId, ref: 'Sos' })
    currentMissionId?: Types.ObjectId;

    @ApiProperty({ example: 'Experienced in crisis management' })
    @Prop()
    bio?: string;

    @ApiProperty({ example: ['Hindi', 'English', 'Kannada'] })
    @Prop({ type: [String], default: [] })
    languages: string[];

    @ApiProperty({ example: { badgeLevel: 'gold' } })
    @Prop({ type: Object })
    metadata?: Record<string, any>;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-15T10:40:00Z' })
    updatedAt: Date;
}

export const VolunteerSchema = SchemaFactory.createForClass(Volunteer);

// Indexes
VolunteerSchema.index({ userId: 1 });
VolunteerSchema.index({ status: 1, verificationStatus: 1 });
VolunteerSchema.index({ 'currentLocation.coordinates': '2dsphere' });
VolunteerSchema.index({ isActive: 1, status: 1 });
VolunteerSchema.index({ skills: 1 });
VolunteerSchema.index({ coveredAreas: 1 });
