import { Controller, Post, Patch, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JourneyService, StartJourneyDto } from './journey.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('journey')
@Controller('journey')
export class JourneyController {
    constructor(private readonly journeyService: JourneyService) { }

    @Post('start')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Start a guarded journey with live tracking link for emergency contacts' })
    async startJourney(@Request() req, @Body() dto: StartJourneyDto) {
        return this.journeyService.startJourney(req.user.userId, dto);
    }

    @Patch('location/:shareToken')
    @ApiOperation({ summary: 'Update live location during a journey' })
    async updateLocation(
        @Param('shareToken') shareToken: string,
        @Body() body: { coordinates: [number, number]; batteryLevel?: number },
    ) {
        return this.journeyService.updateLocation(shareToken, body.coordinates, body.batteryLevel);
    }

    @Post('arrive/:shareToken')
    @ApiOperation({ summary: 'Confirm safe arrival at destination' })
    async markArrived(@Param('shareToken') shareToken: string) {
        return this.journeyService.markArrived(shareToken);
    }

    @Get('track/:shareToken')
    @ApiOperation({ summary: 'Public tracking link viewable by family in any web browser' })
    async getPublicTracking(@Param('shareToken') shareToken: string) {
        return this.journeyService.getPublicTracking(shareToken);
    }
}
