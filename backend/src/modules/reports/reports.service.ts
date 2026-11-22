import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';

export interface CreateReportDto {
    incidentType: string;
    description: string;
    coordinates: [number, number]; // [lng, lat]
    isAnonymous?: boolean;
    photoUrls?: string[];
    severity?: string;
}

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    ) { }

    async createReport(userId: string | undefined, dto: CreateReportDto) {
        const report = await this.reportModel.create({
            incidentType: dto.incidentType,
            description: dto.description,
            location: {
                type: 'Point',
                coordinates: dto.coordinates,
            },
            isAnonymous: dto.isAnonymous !== false,
            userId: dto.isAnonymous ? undefined : (userId ? new Types.ObjectId(userId) : undefined),
            photoUrls: dto.photoUrls || [],
            severity: dto.severity || 'medium',
            status: 'pending',
        });

        this.logger.log(`Incident report filed: ${dto.incidentType} (Anonymous: ${dto.isAnonymous})`);
        return report;
    }

    async getHeatmap() {
        const reports = await this.reportModel.find({}, { location: 1, severity: 1, incidentType: 1 }).limit(200);
        return reports.map(r => ({
            id: r._id,
            type: r.incidentType,
            severity: r.severity,
            lat: r.location?.coordinates?.[1],
            lng: r.location?.coordinates?.[0],
            weight: r.severity === 'high' ? 1.0 : r.severity === 'medium' ? 0.6 : 0.3,
        }));
    }

    async getNearby(lat: number, lng: number, radiusMeters: number = 5000) {
        return this.reportModel.find({
            'location.coordinates': {
                $nearSphere: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lng, lat],
                    },
                    $maxDistance: radiusMeters,
                },
            },
        }).sort({ createdAt: -1 }).limit(50);
    }
}
