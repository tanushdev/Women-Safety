import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Zone, ZoneDocument, ZoneType, ZoneSeverity } from './schemas/zone.schema';

export interface CreateZoneDto {
    name: string;
    description?: string;
    type: ZoneType;
    severity?: ZoneSeverity;
    latitude: number;
    longitude: number;
    radius: number;
    city?: string;
    state?: string;
    address?: string;
    color?: string;
    isActive?: boolean;
}

export interface UpdateZoneDto extends Partial<CreateZoneDto> { }

@Injectable()
export class ZonesService implements OnModuleInit {
    private readonly logger = new Logger(ZonesService.name);

    constructor(
        @InjectModel(Zone.name) private zoneModel: Model<ZoneDocument>,
    ) { }

    async onModuleInit() {
        // Drop old indexes and recreate them with correct configuration
        try {
            this.logger.log('Dropping old zone indexes...');
            await this.zoneModel.collection.dropIndexes();
            this.logger.log('Recreating zone indexes...');

            // Create correct 2dsphere indexes on GeoJSON objects
            await this.zoneModel.collection.createIndex({ area: '2dsphere' });
            await this.zoneModel.collection.createIndex({ centerPoint: '2dsphere' });
            await this.zoneModel.collection.createIndex({ type: 1, isActive: 1 });
            await this.zoneModel.collection.createIndex({ city: 1, state: 1 });
            await this.zoneModel.collection.createIndex({ severity: 1, type: 1 });
            await this.zoneModel.collection.createIndex({ tags: 1 });
            await this.zoneModel.collection.createIndex({ createdAt: -1 });

            this.logger.log('Zone indexes recreated successfully!');
        } catch (error) {
            this.logger.error('Failed to recreate zone indexes:', error.message);
        }
    }

    async create(createZoneDto: CreateZoneDto): Promise<ZoneDocument> {
        // Ensure numeric values are properly parsed
        const latitude = Number(createZoneDto.latitude);
        const longitude = Number(createZoneDto.longitude);
        const radius = Number(createZoneDto.radius) || 500;

        this.logger.log(`Creating zone: name=${createZoneDto.name}, type=${createZoneDto.type}, lat=${latitude}, lng=${longitude}, radius=${radius}`);

        // Validate coordinates
        if (isNaN(latitude) || isNaN(longitude) || isNaN(radius)) {
            throw new Error(`Invalid coordinates: lat=${latitude}, lng=${longitude}, radius=${radius}`);
        }

        try {
            // Create a circular zone using center point and radius
            const points = this.createCirclePolygon(longitude, latitude, radius);

            this.logger.log(`Created polygon with ${points.length} points`);

            const zone = await this.zoneModel.create({
                name: createZoneDto.name,
                description: createZoneDto.description || '',
                type: createZoneDto.type,
                severity: createZoneDto.severity,
                centerPoint: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
                area: {
                    type: 'Polygon',
                    coordinates: [points],
                },
                radius,
                isActive: createZoneDto.isActive ?? true,
            });

            this.logger.log(`Zone created: ${zone.name} (${zone.type})`);
            return zone;
        } catch (error) {
            this.logger.error(`Failed to create zone: ${error.message}`, error.stack);
            throw error;
        }
    }

    async findAll(filters?: {
        type?: ZoneType;
        isActive?: boolean;
        city?: string;
    }): Promise<ZoneDocument[]> {
        const query: any = {};

        if (filters?.type) query.type = filters.type;
        if (filters?.isActive !== undefined) query.isActive = filters.isActive;
        if (filters?.city) query.city = filters.city;

        return this.zoneModel.find(query).sort({ createdAt: -1 }).exec();
    }

    async findById(id: string): Promise<ZoneDocument> {
        const zone = await this.zoneModel.findById(id);
        if (!zone) {
            throw new NotFoundException(`Zone ${id} not found`);
        }
        return zone;
    }

    async findNearby(
        latitude: number,
        longitude: number,
        radiusMeters: number = 5000,
    ): Promise<ZoneDocument[]> {
        return this.zoneModel.find({
            isActive: true,
            'centerPoint.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                    $maxDistance: radiusMeters,
                },
            },
        }).exec();
    }

    async update(id: string, updateZoneDto: UpdateZoneDto): Promise<ZoneDocument> {
        const zone = await this.findById(id);

        // If location updated, recalculate polygon
        if (updateZoneDto.latitude && updateZoneDto.longitude) {
            const lat = Number(updateZoneDto.latitude);
            const lng = Number(updateZoneDto.longitude);
            const rad = Number(updateZoneDto.radius) || zone.radius || 500;
            const points = this.createCirclePolygon(lng, lat, rad);

            zone.centerPoint = {
                type: 'Point',
                coordinates: [lng, lat],
            };
            zone.area = {
                type: 'Polygon',
                coordinates: [points],
            };
        }

        // Update other fields
        if (updateZoneDto.name) zone.name = updateZoneDto.name;
        if (updateZoneDto.description) zone.description = updateZoneDto.description;
        if (updateZoneDto.type) zone.type = updateZoneDto.type;
        if (updateZoneDto.severity) zone.severity = updateZoneDto.severity;
        if (updateZoneDto.radius) zone.radius = Number(updateZoneDto.radius);
        if (updateZoneDto.city) zone.city = updateZoneDto.city;
        if (updateZoneDto.state) zone.state = updateZoneDto.state;
        if (updateZoneDto.address) zone.address = updateZoneDto.address;
        if (updateZoneDto.color) zone.color = updateZoneDto.color;
        if (updateZoneDto.isActive !== undefined) zone.isActive = updateZoneDto.isActive;

        await zone.save();
        this.logger.log(`Zone updated: ${zone.name}`);
        return zone;
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.zoneModel.findByIdAndDelete(id);
        if (result) {
            this.logger.log(`Zone deleted: ${id}`);
            return true;
        }
        return false;
    }

    async getStats() {
        const [total, active, safe, danger] = await Promise.all([
            this.zoneModel.countDocuments(),
            this.zoneModel.countDocuments({ isActive: true }),
            this.zoneModel.countDocuments({ type: ZoneType.SAFE }),
            this.zoneModel.countDocuments({ type: ZoneType.DANGER }),
        ]);

        return { total, active, safe, danger };
    }

    // Helper: Create approximate circle polygon
    private createCirclePolygon(
        centerLng: number,
        centerLat: number,
        radiusMeters: number,
        numPoints: number = 32,
    ): number[][] {
        const coords: number[][] = [];
        const earthRadius = 6371000; // meters

        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const latOffset = (radiusMeters / earthRadius) * Math.cos(angle) * (180 / Math.PI);
            const lngOffset = (radiusMeters / earthRadius) * Math.sin(angle) * (180 / Math.PI) / Math.cos(centerLat * Math.PI / 180);

            coords.push([centerLng + lngOffset, centerLat + latOffset]);
        }

        return coords;
    }
}
