import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type JourneyDocument = Journey & Document;

class Location {
    @Prop({ type: String, enum: ['Point'], default: 'Point' })
    type: string;

    @Prop({ type: [Number], index: '2dsphere' })
    coordinates: number[]; // [lng, lat]
}

@Schema({ timestamps: true })
export class Journey {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @ApiProperty({ example: 'MG Road Metro Station' })
    @Prop({ required: true })
    destinationName: string;

    @ApiProperty({ type: Location })
    @Prop({ type: Location })
    destinationCoordinates: Location;

    @ApiProperty({ type: Location })
    @Prop({ type: Location })
    currentLocation: Location;

    @ApiProperty({ example: '2026-11-21T23:45:00Z' })
    @Prop({ required: true })
    eta: Date;

    @ApiProperty({ example: 'active' })
    @Prop({ type: String, enum: ['active', 'completed', 'alerted', 'cancelled'], default: 'active' })
    status: string;

    @ApiProperty({ example: 'tr_secure_token_123' })
    @Prop({ required: true, unique: true, index: true })
    shareToken: string;

    @Prop({ type: [String], default: [] })
    guardianPhones: string[];

    @Prop({ type: Number, default: 100 })
    batteryLevel?: number;

    @Prop({ type: Date })
    arrivedAt?: Date;
}

export const JourneySchema = SchemaFactory.createForClass(Journey);
