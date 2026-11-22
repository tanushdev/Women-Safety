import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportsService, CreateReportDto } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Post('incident')
    @ApiOperation({ summary: 'Submit an anonymous or verified community danger report' })
    async createReport(@Request() req, @Body() dto: CreateReportDto) {
        const userId = req.user?.userId;
        return this.reportsService.createReport(userId, dto);
    }

    @Get('heatmap')
    @ApiOperation({ summary: 'Get all danger points formatted for heatmap visualization' })
    async getHeatmap() {
        return this.reportsService.getHeatmap();
    }

    @Get('nearby')
    @ApiOperation({ summary: 'Get recent incident reports near coordinates' })
    async getNearby(
        @Query('lat') lat: string,
        @Query('lng') lng: string,
        @Query('radius') radius?: string,
    ) {
        return this.reportsService.getNearby(
            parseFloat(lat || '0'),
            parseFloat(lng || '0'),
            radius ? parseInt(radius) : 5000,
        );
    }
}
