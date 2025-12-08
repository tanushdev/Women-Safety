import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SosService } from './sos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('sos')
@Controller('sos')
export class SosController {
    constructor(private readonly sosService: SosService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create SOS alert' })
    async create(@Request() req, @Body() createSosDto: any) {
        return this.sosService.create({
            ...createSosDto,
            userId: req.user.userId,
        });
    }

    @Get()
    @ApiOperation({ summary: 'Get all SOS incidents' })
    @ApiQuery({ name: 'status', required: false })
    async findAll(@Query('status') status?: string) {
        const filters: any = {}
        if (status) {
            filters.status = { $in: status.split(',') }
        }
        return this.sosService.findAll(filters);
    }

    @Get('active')
    @ApiOperation({ summary: 'Get active SOS incidents' })
    async findActive() {
        return this.sosService.findActive();
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get SOS statistics' })
    async getStats() {
        return this.sosService.getStats();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get SOS by ID' })
    async findOne(@Param('id') id: string) {
        return this.sosService.findOne(id);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update SOS status' })
    async updateStatus(
        @Param('id') id: string,
        @Body() body: { status: string },
        @Request() req,
    ) {
        const userId = req.user?.userId || 'admin';
        return this.sosService.updateStatus(id, body.status, userId);
    }

    @Patch(':id/resolve')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Resolve SOS' })
    async resolve(@Param('id') id: string, @Request() req) {
        return this.sosService.resolve(id, req.user.userId);
    }

    @Patch(':id/cancel')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cancel SOS' })
    async cancel(@Param('id') id: string, @Request() req) {
        return this.sosService.cancel(id, req.user.userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete SOS record' })
    async delete(@Param('id') id: string) {
        const deleted = await this.sosService.delete(id);
        return { success: deleted, message: deleted ? 'SOS deleted' : 'SOS not found' };
    }
    @Patch(':id/location')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update SOS location' })
    async updateLocation(
        @Param('id') id: string,
        @Body() body: { latitude: number; longitude: number },
    ) {
        return this.sosService.updateLocation(id, body.latitude, body.longitude);
    }
}
