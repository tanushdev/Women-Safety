import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ZoneDocument = Zone & Document;

export enum ZoneType {
    SAFE = 'safe',
    DANGER = 'danger',
    CROWDED = 'crowded',
    POLICE_STATION = 'police_station',
    HOSPITAL = 'hospital',
    SHELTER = 'shelter',
}

export enum ZoneSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

class GeoJsonPolygon {
    @ApiProperty({ example: 'Polygon' })
    @Prop({ type: String, enum: ['Polygon'], default: 'Polygon' })
    type: string;

    @ApiProperty({
        example: [
            [
                [77.5946, 12.9716],
                [77.5956, 12.9716],
                [77.5956, 12.9726],
                [77.5946, 12.9726],
                [77.5946, 12.9716],
            ],
        ],
    })
    @Prop({ type: [[[Number]]], required: true })
    coordinates: number[][][]; // [[[lon, lat], ...]]
}

class GeoJsonPoint {
    @ApiProperty({ example: 'Point' })
    @Prop({ type: String, enum: ['Point'], default: 'Point' })
    type: string;

    @ApiProperty({ example: [77.5946, 12.9716] })
    @Prop({ type: [Number], required: true })
    coordinates: number[]; // [longitude, latitude]
}

class IncidentStats {
    @ApiProperty({ example: 15 })
    @Prop({ default: 0 })
    totalIncidents: number;

    @ApiProperty({ example: 3 })
    @Prop({ default: 0 })
    last30Days: number;

    @ApiProperty({ example: 1 })
    @Prop({ default: 0 })
    last7Days: number;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    @Prop()
    lastIncidentAt?: Date;
}

@Schema({ timestamps: true })
export class Zone {
    @ApiProperty({ example: 'MG Road - High Alert Zone' })
    @Prop({ required: true })
    name: string;

    @ApiProperty({ example: 'Multiple incidents reported in this area' })
    @Prop()
    description?: string;

    @ApiProperty({ enum: ZoneType, example: ZoneType.DANGER })
    @Prop({ type: String, enum: ZoneType, required: true, index: true })
    type: ZoneType;

    @ApiProperty({ enum: ZoneSeverity, example: ZoneSeverity.HIGH })
    @Prop({ type: String, enum: ZoneSeverity })
    severity?: ZoneSeverity;

    @ApiProperty({ type: GeoJsonPolygon })
    @Prop({ type: GeoJsonPolygon, required: true })
    area: GeoJsonPolygon;

    @ApiProperty({ type: GeoJsonPoint })
    @Prop({ type: GeoJsonPoint })
    centerPoint?: GeoJsonPoint;

    @ApiProperty({ example: 500 })
    @Prop()
    radius?: number; // meters (if circular zone)

    @ApiProperty({ example: '#FF5252' })
    @Prop()
    color?: string; // For map visualization

    @ApiProperty({ example: true })
    @Prop({ default: true })
    isActive: boolean;

    @ApiProperty({ example: 8.5 })
    @Prop()
    areaSize?: number; // square kilometers

    @ApiProperty({ type: IncidentStats })
    @Prop({ type: IncidentStats, default: () => ({}) })
    incidentStats: IncidentStats;

    @ApiProperty({ example: 'Koramangala, Bangalore, Karnataka' })
    @Prop()
    address?: string;

    @ApiProperty({ example: 'Bangalore' })
    @Prop({ index: true })
    city?: string;

    @ApiProperty({ example: 'Karnataka' })
    @Prop({ index: true })
    state?: string;

    @ApiProperty({ example: 'India' })
    @Prop()
    country?: string;

    @ApiProperty({ example: '560001' })
    @Prop()
    postalCode?: string;

    @ApiProperty({ example: ['nighttime', 'poorly_lit'] })
    @Prop({ type: [String], default: [] })
    tags: string[];

    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    @Prop({ type: Types.ObjectId, ref: 'User' })
    createdBy?: Types.ObjectId;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    @Prop()
    verifiedAt?: Date;

    @ApiProperty({ example: '507f1f77bcf86cd799439012' })
    @Prop({ type: Types.ObjectId, ref: 'User' })
    verifiedBy?: Types.ObjectId;

    @ApiProperty({ example: true })
    @Prop({ default: false })
    isVerified: boolean;

    @ApiProperty({ example: 250 })
    @Prop()
    crowdDensity?: number; // people per square km

    @ApiProperty({ example: '22:00-06:00' })
    @Prop()
    activeHours?: string;

    @ApiProperty({ example: { policeStation: 'MG Road Police Station' } })
    @Prop({ type: Object })
    metadata?: Record<string, any>;

    @ApiProperty({ example: '2024-01-15T10:30:00Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-15T10:40:00Z' })
    updatedAt: Date;
}

export const ZoneSchema = SchemaFactory.createForClass(Zone);

// Indexes - 2dsphere indexes must be on the GeoJSON object, not coordinates array
ZoneSchema.index({ area: '2dsphere' });
ZoneSchema.index({ centerPoint: '2dsphere' });
ZoneSchema.index({ type: 1, isActive: 1 });
ZoneSchema.index({ city: 1, state: 1 });
ZoneSchema.index({ severity: 1, type: 1 });
ZoneSchema.index({ tags: 1 });
ZoneSchema.index({ createdAt: -1 });
