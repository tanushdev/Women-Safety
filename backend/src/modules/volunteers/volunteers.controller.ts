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
    UseGuards,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VolunteersService, RegisterVolunteerDto } from './volunteers.service';
import { VolunteerStatus, VolunteerVerificationStatus } from './schemas/volunteer.schema';

@ApiTags('volunteers')
@Controller('volunteers')
export class VolunteersController {
    constructor(private readonly volunteersService: VolunteersService) { }

    @Post('register')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Register as a volunteer' })
    @ApiResponse({ status: 201, description: 'Volunteer registration submitted' })
    async register(@Req() req: any, @Body() dto: Partial<RegisterVolunteerDto>) {
        return this.volunteersService.register({
            ...dto,
            userId: req.user.userId,
        } as RegisterVolunteerDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all volunteers' })
    @ApiQuery({ name: 'status', required: false, enum: VolunteerStatus })
    @ApiQuery({ name: 'verificationStatus', required: false, enum: VolunteerVerificationStatus })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    async findAll(
        @Query('status') status?: VolunteerStatus,
        @Query('verificationStatus') verificationStatus?: VolunteerVerificationStatus,
        @Query('isActive') isActive?: string,
    ) {
        return this.volunteersService.findAll({
            status,
            verificationStatus,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
        });
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get volunteer statistics' })
    async getStats() {
        return this.volunteersService.getStats();
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user volunteer profile' })
    async getMyProfile(@Req() req: any) {
        return this.volunteersService.findByUserId(req.user.userId);
    }

    @Get('nearby')
    @ApiOperation({ summary: 'Get nearby volunteers' })
    @ApiQuery({ name: 'lat', required: true, type: Number })
    @ApiQuery({ name: 'lng', required: true, type: Number })
    @ApiQuery({ name: 'radius', required: false, type: Number })
    async findNearby(
        @Query('lat') lat: string,
        @Query('lng') lng: string,
        @Query('radius') radius?: string,
    ) {
        return this.volunteersService.findNearby(
            parseFloat(lat),
            parseFloat(lng),
            radius ? parseInt(radius) : 5000,
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a volunteer by ID' })
    async findById(@Param('id') id: string) {
        return this.volunteersService.findById(id);
    }

    @Put(':id/approve')
    @ApiOperation({ summary: 'Approve a volunteer (Admin)' })
    @ApiResponse({ status: 200, description: 'Volunteer approved' })
    async approve(@Param('id') id: string) {
        return this.volunteersService.approve(id);
    }

    @Put(':id/reject')
    @ApiOperation({ summary: 'Reject a volunteer (Admin)' })
    @ApiResponse({ status: 200, description: 'Volunteer rejected' })
    async reject(@Param('id') id: string, @Body() body: { reason?: string }) {
        return this.volunteersService.reject(id, body.reason);
    }

    @Put('status')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update volunteer status' })
    async updateStatus(@Req() req: any, @Body() body: { status: VolunteerStatus }) {
        return this.volunteersService.updateStatus(req.user.userId, body.status);
    }

    @Put('location')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update volunteer location' })
    async updateLocation(
        @Req() req: any,
        @Body() body: { latitude: number; longitude: number },
    ) {
        return this.volunteersService.updateLocation(req.user.userId, body.latitude, body.longitude);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a volunteer' })
    async delete(@Param('id') id: string) {
        await this.volunteersService.delete(id);
    }
}
