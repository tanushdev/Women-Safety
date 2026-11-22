import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('dashboard')
    @ApiOperation({ summary: 'Admin overview metrics' })
    async getDashboardOverview() {
        return this.analyticsService.getDashboardOverview();
    }

    @Get('sos-trends')
    @ApiOperation({ summary: 'SOS events grouped over time' })
    async getSosTrends() {
        return this.analyticsService.getSosTrends();
    }

    @Get('zone-safety')
    @ApiOperation({ summary: 'Zone risk and safety scores' })
    async getZoneSafety() {
        return this.analyticsService.getZoneSafety();
    }

    @Get('volunteer-performance')
    @ApiOperation({ summary: 'Volunteer metrics and leaderboard' })
    async getVolunteerPerformance() {
        return this.analyticsService.getVolunteerPerformance();
    }

    @Get('heatmap')
    @ApiOperation({ summary: 'Geographic heatmap points for incidents' })
    async getHeatmap() {
        return this.analyticsService.getHeatmap();
    }
}
