import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type SosDocument = Sos & Document;

export enum SosStatus {
    TRIGGERED = 'TRIGGERED',
    IN_PROGRESS = 'IN_PROGRESS',
    RESOLVED = 'RESOLVED',
    FALSE_ALARM = 'FALSE_ALARM',
    CANCELLED = 'CANCELLED',
}

export enum SosTriggerType {
    BUTTON = 'button',
    SHAKE = 'shake',
    POWER_TAP = 'power_tap',
    BACK_TAP = 'back_tap',
    VOICE_COMMAND = 'voice_command',
    AUTO_INACTIVITY = 'auto_inactivity',
}

export enum SosSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

class Location {
    @ApiProperty({ example: 'Point' })
    @Prop({ type: String, enum: ['Point'], default: 'Point' })
    type: string;

    @ApiProperty({ example: [77.5946, 12.9716] })
    @Prop({ type: [Number], index: '2dsphere' })
    coordinates: number[]; // [longitude, latitude]
}

class LocationHistory {
    @ApiProperty({ type: Location })
    @Prop({ type: Location, required: true })
    location: Location;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    @Prop({ type: Date, default: Date.now })
    timestamp: Date;

    @ApiProperty({ example: 15.5 })
    @Prop()
    accuracy?: number; // meters

    @ApiProperty({ example: 45.5 })
    @Prop()
    speed?: number; // km/h
}

class AssignedVolunteer {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    volunteerId: Types.ObjectId;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    @Prop({ type: Date, default: Date.now })
    assignedAt: Date;

    @ApiProperty({ example: '2024-01-15T10:35:00Z' })
    @Prop()
    respondedAt?: Date;

    @ApiProperty({ example: 'accepted' })
    @Prop({ type: String, enum: ['pending', 'accepted', 'declined', 'arrived'] })
    status: string;

    @ApiProperty({ example: 1200 })
    @Prop()
    distanceAtAssignment?: number; // meters

    @ApiProperty({ example: 5 })
    @Prop()
    estimatedArrivalMinutes?: number;
}

@Schema({ timestamps: true })
export class Sos {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @ApiProperty({ enum: SosStatus, example: SosStatus.TRIGGERED })
    @Prop({ type: String, enum: SosStatus, default: SosStatus.TRIGGERED, index: true })
    status: SosStatus;

    @ApiProperty({ enum: SosTriggerType, example: SosTriggerType.BUTTON })
    @Prop({ type: String, enum: SosTriggerType, required: true })
    triggerType: SosTriggerType;

    @ApiProperty({ enum: SosSeverity, example: SosSeverity.HIGH })
    @Prop({ type: String, enum: SosSeverity, default: SosSeverity.HIGH })
    severity: SosSeverity;

    @ApiProperty({ type: Location })
    @Prop({ type: Location, required: true })
    initialLocation: Location;

    @ApiProperty({ type: Location })
    @Prop({ type: Location })
    currentLocation?: Location;

    @ApiProperty({ type: [LocationHistory] })
    @Prop({ type: [LocationHistory], default: [] })
    locationHistory: LocationHistory[];

    @ApiProperty({ example: 'Test SOS - Please ignore' })
    @Prop()
    note?: string;

    @ApiProperty({ example: 'https://s3.../audio.mp3' })
    @Prop()
    audioRecordingUrl?: string;

    @ApiProperty({ example: 18.5 })
    @Prop()
    audioRecordingDuration?: number; // seconds

    @ApiProperty({ type: [String], example: ['https://s3.../photo1.jpg'] })
    @Prop({ type: [String], default: [] })
    mediaUrls: string[];

    @ApiProperty({ type: [AssignedVolunteer] })
    @Prop({ type: [AssignedVolunteer], default: [] })
    assignedVolunteers: AssignedVolunteer[];

    @ApiProperty({ example: true })
    @Prop({ default: false })
    policeNotified: boolean;

    @ApiProperty({ example: '2024-01-15T10:31:00Z' })
    @Prop()
    policeNotifiedAt?: Date;

    @ApiProperty({ example: 'POLICE-REF-12345' })
    @Prop()
    policeReferenceId?: string;

    @ApiProperty({ example: true })
    @Prop({ default: false })
    emergencyContactsNotified: boolean;

    @ApiProperty({ example: '2024-01-15T10:30:30Z' })
    @Prop()
    emergencyContactsNotifiedAt?: Date;

    @ApiProperty({ example: 'Koramangala, Bangalore' })
    @Prop()
    address?: string;

    @ApiProperty({ example: true })
    @Prop({ default: false })
    isInDangerZone: boolean;

    @ApiProperty({ example: '507f1f77bcf86cd799439012' })
    @Prop({ type: Types.ObjectId, ref: 'Zone' })
    dangerZoneId?: Types.ObjectId;

    @ApiProperty({ example: '2024-01-15T10:40:00Z' })
    @Prop()
    resolvedAt?: Date;

    @ApiProperty({ example: '507f1f77bcf86cd799439013' })
    @Prop({ type: Types.ObjectId, ref: 'User' })
    resolvedBy?: Types.ObjectId;

    @ApiProperty({ example: 'User confirmed safe' })
    @Prop()
    resolutionNote?: string;

    @ApiProperty({ example: 600 })
    @Prop()
    responseDuration?: number; // seconds from trigger to resolution

    @ApiProperty({ example: 4.5 })
    @Prop()
    userRating?: number; // 1-5 rating

    @ApiProperty({ example: 'Quick response, very helpful' })
    @Prop()
    userFeedback?: string;

    @ApiProperty({ example: { temperature: 28, weather: 'clear' } })
    @Prop({ type: Object })
    metadata?: Record<string, any>;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-15T10:40:00Z' })
    updatedAt: Date;
}

export const SosSchema = SchemaFactory.createForClass(Sos);

// Indexes
SosSchema.index({ userId: 1, status: 1 });
SosSchema.index({ status: 1, createdAt: -1 });
SosSchema.index({ 'initialLocation.coordinates': '2dsphere' });
SosSchema.index({ 'currentLocation.coordinates': '2dsphere' });
SosSchema.index({ createdAt: -1 });
SosSchema.index({ triggerType: 1 });
SosSchema.index({ severity: 1, status: 1 });
SosSchema.index({ isInDangerZone: 1 });
