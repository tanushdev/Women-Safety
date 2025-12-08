import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
    private readonly logger = new Logger(WsJwtGuard.name);

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        try {
            const client: Socket = context.switchToWs().getClient<Socket>();

            // Get token from handshake auth or query
            const token = this.extractTokenFromClient(client);

            if (!token) {
                // Allow connection but mark as unauthenticated
                // This allows anonymous tracking for demo purposes
                client.data.authenticated = false;
                client.data.userId = null;
                this.logger.debug('WebSocket client connected without auth token');
                return true;
            }

            // Verify JWT token
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET'),
            });

            // Attach user data to socket
            client.data.authenticated = true;
            client.data.userId = payload.sub;
            client.data.role = payload.role;
            client.data.phone = payload.phone;

            this.logger.debug(`WebSocket client authenticated: ${payload.sub}`);
            return true;
        } catch (error) {
            this.logger.warn(`WebSocket JWT validation failed: ${error.message}`);
            // Still allow connection for demo purposes
            const client: Socket = context.switchToWs().getClient<Socket>();
            client.data.authenticated = false;
            return true;
        }
    }

    private extractTokenFromClient(client: Socket): string | null {
        // Try handshake auth
        const authHeader = client.handshake?.auth?.token;
        if (authHeader) {
            return authHeader;
        }

        // Try authorization header
        const headers = client.handshake?.headers;
        if (headers?.authorization) {
            const [type, token] = headers.authorization.split(' ');
            if (type === 'Bearer' && token) {
                return token;
            }
        }

        // Try query parameter
        const queryToken = client.handshake?.query?.token;
        if (queryToken && typeof queryToken === 'string') {
            return queryToken;
        }

        return null;
    }
}
