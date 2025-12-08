import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type UserDocument = User & Document;

export enum UserRole {
    USER = 'user',
    VOLUNTEER = 'volunteer',
    ADMIN = 'admin',
    SUPER_ADMIN = 'super_admin',
}

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended',
    DELETED = 'deleted',
}

class EmergencyContact {
    @ApiProperty({ example: 'John Doe' })
    @Prop({ required: true })
    name: string;

    @ApiProperty({ example: '+919876543210' })
    @Prop({ required: true })
    phone: string;

    @ApiProperty({ example: 'brother' })
    @Prop()
    relationship?: string;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    notifyOnSOS: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: false })
    whatsappEnabled: boolean;
}

class Location {
    @ApiProperty({ example: 'Point' })
    @Prop({ type: String, enum: ['Point'], default: 'Point' })
    type: string;

    @ApiProperty({ example: [77.5946, 12.9716] })
    @Prop({ type: [Number], index: '2dsphere' })
    coordinates: number[]; // [longitude, latitude]
}

class UserSettings {
    @ApiProperty({ example: true })
    @Prop({ default: true })
    shakeSOS: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    powerButtonSOS: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: false })
    voiceCommandSOS: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    autoRecordAudio: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    shareLocationWithContacts: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    redZoneAlerts: boolean;

    @ApiProperty({ example: 10 })
    @Prop({ default: 10 })
    inactivityThresholdMinutes: number;
}

@Schema({ timestamps: true })
export class User {
    @ApiProperty({ example: 'Jane Doe' })
    @Prop({ required: true })
    name: string;

    @ApiProperty({ example: '+919876543210' })
    @Prop({ required: true, unique: true })
    phone: string;

    @ApiProperty({ example: 'jane@example.com' })
    @Prop({ unique: true, sparse: true })
    email?: string;

    @ApiProperty({ example: 'hashedPassword123' })
    @Prop()
    password?: string;

    @ApiProperty({ example: 'https://example.com/photo.jpg' })
    @Prop()
    profilePhoto?: string;

    @ApiProperty({ example: '123456789012' })
    @Prop({ unique: true, sparse: true })
    aadharNumber?: string;

    @ApiProperty({ example: 25 })
    @Prop()
    age?: number;

    @ApiProperty({ enum: UserRole, example: UserRole.USER })
    @Prop({ type: String, enum: UserRole, default: UserRole.USER })
    role: UserRole;

    @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
    @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
    status: UserStatus;

    @ApiProperty({ type: Location })
    @Prop({ type: Location })
    lastLocation?: Location;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    @Prop()
    lastLocationUpdate?: Date;

    @ApiProperty({ type: [EmergencyContact] })
    @Prop({ type: [EmergencyContact], default: [] })
    emergencyContacts: EmergencyContact[];

    @ApiProperty({ type: UserSettings })
    @Prop({ type: UserSettings, default: () => ({}) })
    settings: UserSettings;

    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    @Prop()
    refreshToken?: string;

    @ApiProperty({ example: 'device-token-123' })
    @Prop()
    deviceToken?: string;

    @ApiProperty({ example: 'fcm-token-456' })
    @Prop()
    fcmToken?: string;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    isPhoneVerified: boolean;

    @ApiProperty({ example: true })
    @Prop({ default: false })
    isEmailVerified: boolean;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    @Prop()
    lastLogin?: Date;

    @ApiProperty({ example: { age: 25, bloodGroup: 'O+' } })
    @Prop({ type: Object })
    metadata?: Record<string, any>;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ phone: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ 'lastLocation.coordinates': '2dsphere' });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ createdAt: -1 });
