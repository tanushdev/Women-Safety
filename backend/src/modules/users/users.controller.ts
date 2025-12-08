import { Controller, Get, Patch, Delete, Put, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    // Public endpoint for admin dashboard to get all users
    @Get()
    @ApiOperation({ summary: 'Get all users (Admin)' })
    async findAll() {
        return this.usersService.findAll();
    }

    // IMPORTANT: /me routes MUST come BEFORE /:id routes to avoid conflicts
    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    async getProfile(@Request() req) {
        return this.usersService.findById(req.user.userId);
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update current user profile' })
    async updateProfile(@Request() req, @Body() updateData: any) {
        return this.usersService.updateProfile(req.user.userId, updateData);
    }

    @Delete('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete current user account and all data' })
    async deleteAccount(@Request() req) {
        await this.usersService.deleteUser(req.user.userId);
        return { success: true, message: 'Account and all associated data deleted successfully' };
    }

    @Patch('location')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update user location' })
    async updateLocation(@Request() req, @Body() body: { coordinates: [number, number] }) {
        return this.usersService.updateLocation(req.user.userId, body.coordinates);
    }

    @Get('me/emergency-contacts')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get emergency contacts' })
    async getEmergencyContacts(@Request() req) {
        const user = await this.usersService.findById(req.user.userId);
        return user?.emergencyContacts || [];
    }

    @Put('me/emergency-contacts')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update all emergency contacts' })
    async updateEmergencyContacts(@Request() req, @Body() body: { contacts: any[] }) {
        return this.usersService.updateEmergencyContacts(req.user.userId, body.contacts);
    }

    @Patch('me/emergency-contacts')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Add emergency contact' })
    async addEmergencyContact(@Request() req, @Body() contact: any) {
        return this.usersService.addEmergencyContact(req.user.userId, contact);
    }

    // Admin endpoint to delete a user by ID - MUST come AFTER /me routes
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a user by ID (Admin)' })
    async deleteUserById(@Param('id') id: string) {
        await this.usersService.deleteUser(id);
        return { success: true, message: 'User deleted successfully' };
    }
}

