import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';

interface LocationUpdate {
    sosId?: string;
    userId?: string;
    location: {
        coordinates: [number, number]; // [longitude, latitude]
        accuracy?: number;
        speed?: number;
    };
    timestamp: Date;
}

interface SosAlert {
    sosId: string;
    userId: string;
    triggerType: string;
    severity: string;
    location: {
        coordinates: [number, number];
    };
    timestamp: Date;
}

@WebSocketGateway({
    namespace: '/',
    cors: {
        origin: true,
        credentials: true,
    },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private logger: Logger = new Logger('EventsGateway');
    private userSockets: Map<string, string> = new Map(); // userId -> socketId
    private adminSockets: Set<string> = new Set(); // adminSocketIds

    constructor(private configService: ConfigService) { }

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized');
        this.logger.log(`CORS enabled for: ${this.configService.get('SOCKET_CORS_ORIGIN')}`);
    }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);

        // Send welcome message
        client.emit('connection:success', {
            message: 'Connected to Women Safety System',
            socketId: client.id,
            timestamp: new Date(),
        });
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);

        // Remove from tracking
        for (const [userId, socketId] of this.userSockets.entries()) {
            if (socketId === client.id) {
                this.userSockets.delete(userId);
                this.logger.log(`Removed user ${userId} from tracking`);
                break;
            }
        }

        this.adminSockets.delete(client.id);
    }

    // ==================== AUTHENTICATION ====================

    @SubscribeMessage('auth:register')
    handleAuthRegister(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { userId: string; role: string; token?: string },
    ) {
        try {
            const { userId, role } = data;

            // Register user socket
            this.userSockets.set(userId, client.id);

            // Track admin sockets separately
            if (role === 'admin' || role === 'super_admin') {
                this.adminSockets.add(client.id);
                client.join('admin-room');
                this.logger.log(`Admin registered: ${userId}`);
            }

            // Join user's personal room
            client.join(`user:${userId}`);

            client.emit('auth:registered', {
                success: true,
                userId,
                role,
                message: 'Successfully registered for real-time updates',
            });

            this.logger.log(`User registered: ${userId} (${role})`);
        } catch (error) {
            this.logger.error(`Auth registration error: ${error.message}`);
            client.emit('error', { message: 'Authentication failed' });
        }
    }

    // ==================== SOS EVENTS ====================

    @SubscribeMessage('sos:create')
    handleSosCreate(@ConnectedSocket() client: Socket, @MessageBody() data: SosAlert) {
        try {
            const { sosId, userId } = data;

            // Join SOS-specific room
            client.join(`sos:${sosId}`);

            // Broadcast to all admins
            this.server.to('admin-room').emit('sos:new', data);

            // Notify nearby volunteers (implement geospatial query)
            this.notifyNearbyVolunteers(data);

            this.logger.log(`SOS created: ${sosId} by user ${userId}`);

            return { success: true, sosId };
        } catch (error) {
            this.logger.error(`SOS create error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    @SubscribeMessage('sos:location:update')
    handleLocationUpdate(@ConnectedSocket() client: Socket, @MessageBody() data: LocationUpdate) {
        try {
            const { sosId, userId, location, timestamp } = data;

            if (sosId) {
                // Broadcast to SOS room (admins, volunteers assigned)
                this.server.to(`sos:${sosId}`).emit('sos:location:updated', {
                    sosId,
                    location,
                    timestamp,
                });
            }

            if (userId) {
                // Update user location for tracking
                this.server.to(`user:${userId}`).emit('location:updated', {
                    location,
                    timestamp,
                });
            }

            return { success: true };
        } catch (error) {
            this.logger.error(`Location update error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    @SubscribeMessage('sos:status:update')
    handleSosStatusUpdate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sosId: string; status: string; updatedBy: string },
    ) {
        try {
            const { sosId, status, updatedBy } = data;

            // Broadcast to SOS room
            this.server.to(`sos:${sosId}`).emit('sos:status:changed', {
                sosId,
                status,
                updatedBy,
                timestamp: new Date(),
            });

            // Notify admins
            this.server.to('admin-room').emit('sos:status:changed', {
                sosId,
                status,
                updatedBy,
                timestamp: new Date(),
            });

            this.logger.log(`SOS ${sosId} status updated to ${status}`);

            return { success: true };
        } catch (error) {
            this.logger.error(`SOS status update error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    @SubscribeMessage('sos:cancel')
    handleSosCancel(@ConnectedSocket() client: Socket, @MessageBody() data: { sosId: string; userId: string }) {
        try {
            const { sosId, userId } = data;

            // Broadcast cancellation
            this.server.to(`sos:${sosId}`).emit('sos:cancelled', {
                sosId,
                userId,
                timestamp: new Date(),
            });

            this.server.to('admin-room').emit('sos:cancelled', {
                sosId,
                userId,
                timestamp: new Date(),
            });

            this.logger.log(`SOS ${sosId} cancelled by user ${userId}`);

            return { success: true };
        } catch (error) {
            this.logger.error(`SOS cancel error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // ==================== VOLUNTEER EVENTS ====================

    @SubscribeMessage('volunteer:assign')
    handleVolunteerAssign(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sosId: string; volunteerId: string; distance: number },
    ) {
        try {
            const { sosId, volunteerId, distance } = data;

            // Notify volunteer
            const volunteerSocketId = this.userSockets.get(volunteerId);
            if (volunteerSocketId) {
                this.server.to(volunteerSocketId).emit('volunteer:assigned', {
                    sosId,
                    distance,
                    timestamp: new Date(),
                });
            }

            // Notify SOS room
            this.server.to(`sos:${sosId}`).emit('volunteer:assigned', {
                sosId,
                volunteerId,
                distance,
                timestamp: new Date(),
            });

            this.logger.log(`Volunteer ${volunteerId} assigned to SOS ${sosId}`);

            return { success: true };
        } catch (error) {
            this.logger.error(`Volunteer assign error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    @SubscribeMessage('volunteer:response')
    handleVolunteerResponse(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sosId: string; volunteerId: string; response: 'accepted' | 'declined' },
    ) {
        try {
            const { sosId, volunteerId, response } = data;

            // Notify SOS room and admins
            this.server.to(`sos:${sosId}`).emit('volunteer:responded', {
                sosId,
                volunteerId,
                response,
                timestamp: new Date(),
            });

            this.server.to('admin-room').emit('volunteer:responded', {
                sosId,
                volunteerId,
                response,
                timestamp: new Date(),
            });

            this.logger.log(`Volunteer ${volunteerId} ${response} SOS ${sosId}`);

            return { success: true };
        } catch (error) {
            this.logger.error(`Volunteer response error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // ==================== ZONE EVENTS ====================

    @SubscribeMessage('zone:update')
    handleZoneUpdate(@ConnectedSocket() client: Socket, @MessageBody() data: { zoneId: string; type: string }) {
        try {
            // Broadcast zone update to all connected clients
            this.server.emit('zone:updated', {
                ...data,
                timestamp: new Date(),
            });

            this.logger.log(`Zone ${data.zoneId} updated`);

            return { success: true };
        } catch (error) {
            this.logger.error(`Zone update error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    @SubscribeMessage('zone:enter')
    handleZoneEnter(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { userId: string; zoneId: string; zoneType: string },
    ) {
        try {
            const { userId, zoneId, zoneType } = data;

            // Notify user
            const userSocketId = this.userSockets.get(userId);
            if (userSocketId) {
                this.server.to(userSocketId).emit('zone:entered', {
                    zoneId,
                    zoneType,
                    timestamp: new Date(),
                });
            }

            // Log zone entry for analytics
            this.logger.log(`User ${userId} entered ${zoneType} zone ${zoneId}`);

            return { success: true };
        } catch (error) {
            this.logger.error(`Zone enter error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // ==================== RED ZONE INACTIVITY ====================

    @SubscribeMessage('redzone:inactivity:alert')
    handleRedZoneInactivity(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { userId: string; zoneId: string; duration: number },
    ) {
        try {
            // Alert admins about inactivity in red zone
            this.server.to('admin-room').emit('redzone:inactivity', {
                ...data,
                timestamp: new Date(),
            });

            this.logger.warn(`Red zone inactivity alert for user ${data.userId}`);

            return { success: true };
        } catch (error) {
            this.logger.error(`Red zone inactivity error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Emit event to specific user
     */
    emitToUser(userId: string, event: string, data: any) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.server.to(socketId).emit(event, data);
            return true;
        }
        return false;
    }

    /**
     * Emit event to all admins
     */
    emitToAdmins(event: string, data: any) {
        this.server.to('admin-room').emit(event, data);
    }

    /**
     * Emit to SOS room
     */
    emitToSosRoom(sosId: string, event: string, data: any) {
        this.server.to(`sos:${sosId}`).emit(event, data);
    }

    /**
     * Notify nearby volunteers about new SOS
     * Uses simple distance calculation for nearby determination
     */
    private async notifyNearbyVolunteers(sosAlert: SosAlert) {
        const [sosLng, sosLat] = sosAlert.location.coordinates;
        const maxDistanceKm = 5; // 5km radius for nearby volunteers

        // Get all connected volunteer sockets
        const rooms = this.server.sockets.adapter.rooms;
        let notifiedCount = 0;

        for (const [userId, socketId] of this.userSockets.entries()) {
            try {
                const socket = this.server.sockets.sockets.get(socketId);
                if (!socket) continue;

                // Check if this is a volunteer (from socket data)
                const role = socket.data?.role;
                if (role !== 'volunteer') continue;

                // Get volunteer's last known location
                const volunteerLocation = socket.data?.location;
                if (!volunteerLocation) {
                    // If no location, still notify but mark as unknown distance
                    socket.emit('volunteer:sos:nearby', {
                        ...sosAlert,
                        distance: null,
                        message: 'New SOS alert in your area',
                    });
                    notifiedCount++;
                    continue;
                }

                // Calculate distance using Haversine formula
                const distance = this.calculateDistance(
                    sosLat,
                    sosLng,
                    volunteerLocation.latitude,
                    volunteerLocation.longitude,
                );

                if (distance <= maxDistanceKm) {
                    socket.emit('volunteer:sos:nearby', {
                        ...sosAlert,
                        distance: Math.round(distance * 1000), // Convert to meters
                        message: `SOS alert ${Math.round(distance * 1000)}m away`,
                    });
                    notifiedCount++;
                    this.logger.log(`Notified volunteer ${userId} at ${distance.toFixed(2)}km`);
                }
            } catch (error) {
                this.logger.error(`Error notifying volunteer ${userId}: ${error.message}`);
            }
        }

        // If no volunteers found, broadcast to all (fallback)
        if (notifiedCount === 0) {
            this.server.emit('volunteer:sos:nearby', {
                ...sosAlert,
                distance: null,
                message: 'Urgent SOS alert - All volunteers',
            });
            this.logger.log('Broadcasted SOS to all volunteers (no nearby found)');
        } else {
            this.logger.log(`Notified ${notifiedCount} nearby volunteers`);
        }
    }

    /**
     * Calculate distance between two points using Haversine formula
     * @returns Distance in kilometers
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * Update volunteer location for proximity calculations
     */
    @SubscribeMessage('volunteer:location:update')
    handleVolunteerLocationUpdate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { latitude: number; longitude: number },
    ) {
        try {
            // Store location in socket data for proximity calculations
            client.data.location = data;
            client.data.locationUpdatedAt = new Date();

            this.logger.debug(`Volunteer location updated: ${data.latitude}, ${data.longitude}`);
            return { success: true };
        } catch (error) {
            this.logger.error(`Volunteer location update error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle user location updates and broadcast to admins
     */
    @SubscribeMessage('user:location:update')
    handleUserLocationUpdate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { userId: string; latitude: number; longitude: number; name?: string },
    ) {
        try {
            const { userId, latitude, longitude, name } = data;

            // Store location in socket data
            client.data.location = { latitude, longitude };
            client.data.locationUpdatedAt = new Date();

            // Broadcast to admin room so admin dashboard sees real-time updates
            this.server.to('admin-room').emit('user:location:updated', {
                userId,
                latitude,
                longitude,
                name: name || 'User',
                timestamp: new Date(),
            });

            this.logger.debug(`User ${userId} location updated: ${latitude}, ${longitude}`);
            return { success: true };
        } catch (error) {
            this.logger.error(`User location update error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
