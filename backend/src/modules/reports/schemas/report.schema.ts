import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ReportDocument = Report & Document;

class Location {
    @Prop({ type: String, enum: ['Point'], default: 'Point' })
    type: string;

    @Prop({ type: [Number], index: '2dsphere' })
    coordinates: number[]; // [lng, lat]
}

@Schema({ timestamps: true })
export class Report {
    @ApiProperty({ example: 'Eve Teasing / Harassment' })
    @Prop({ required: true })
    incidentType: string;

    @ApiProperty({ example: 'Poor street lighting and catcalling near bus stand' })
    @Prop({ required: true })
    description: string;

    @ApiProperty({ type: Location })
    @Prop({ type: Location, required: true })
    location: Location;

    @ApiProperty({ example: true })
    @Prop({ default: true })
    isAnonymous: boolean;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    userId?: Types.ObjectId;

    @Prop({ type: [String], default: [] })
    photoUrls: string[];

    @ApiProperty({ example: 'high' })
    @Prop({ type: String, enum: ['low', 'medium', 'high'], default: 'medium' })
    severity: string;

    @ApiProperty({ example: 'pending' })
    @Prop({ type: String, enum: ['pending', 'verified', 'dismissed'], default: 'pending' })
    status: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ 'location.coordinates': '2dsphere' });
ReportSchema.index({ createdAt: -1 });
