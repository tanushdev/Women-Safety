import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ZonesService, CreateZoneDto, UpdateZoneDto } from './zones.service';
import { ZoneType } from './schemas/zone.schema';

@ApiTags('zones')
@Controller('zones')
export class ZonesController {
    constructor(private readonly zonesService: ZonesService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new zone' })
    @ApiResponse({ status: 201, description: 'Zone created successfully' })
    async create(@Body() createZoneDto: CreateZoneDto) {
        return this.zonesService.create(createZoneDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all zones' })
    @ApiQuery({ name: 'type', required: false, enum: ZoneType })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    @ApiQuery({ name: 'city', required: false, type: String })
    async findAll(
        @Query('type') type?: ZoneType,
        @Query('isActive') isActive?: string,
        @Query('city') city?: string,
    ) {
        return this.zonesService.findAll({
            type,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            city,
        });
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get zone statistics' })
    async getStats() {
        return this.zonesService.getStats();
    }

    @Get('nearby')
    @ApiOperation({ summary: 'Get zones near a location' })
    @ApiQuery({ name: 'lat', required: true, type: Number })
    @ApiQuery({ name: 'lng', required: true, type: Number })
    @ApiQuery({ name: 'radius', required: false, type: Number })
    async findNearby(
        @Query('lat') lat: string,
        @Query('lng') lng: string,
        @Query('radius') radius?: string,
    ) {
        return this.zonesService.findNearby(
            parseFloat(lat),
            parseFloat(lng),
            radius ? parseInt(radius) : 5000,
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a zone by ID' })
    @ApiResponse({ status: 200, description: 'Zone found' })
    @ApiResponse({ status: 404, description: 'Zone not found' })
    async findById(@Param('id') id: string) {
        return this.zonesService.findById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a zone' })
    @ApiResponse({ status: 200, description: 'Zone updated successfully' })
    async update(@Param('id') id: string, @Body() updateZoneDto: UpdateZoneDto) {
        return this.zonesService.update(id, updateZoneDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a zone' })
    @ApiResponse({ status: 204, description: 'Zone deleted successfully' })
    async delete(@Param('id') id: string) {
        await this.zonesService.delete(id);
    }
}
