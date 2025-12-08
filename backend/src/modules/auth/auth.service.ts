import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';

import { User, UserDocument, UserStatus } from '../users/schemas/user.schema';
import { RegisterDto, LoginDto, VerifyOtpDto, RefreshTokenDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly otpCache = new Map<string, { otp: string; expiresAt: Date }>();

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    /**
     * Register new user with phone number
     */
    async register(registerDto: RegisterDto) {
        const { phone, name, email, aadharNumber, age } = registerDto;

        // Check if user already exists
        const existingUser = await this.userModel.findOne({ phone });
        if (existingUser) {
            throw new BadRequestException('User with this phone number already exists');
        }

        // Create new user
        const user = await this.userModel.create({
            phone,
            name,
            email,
            aadharNumber,
            age,
            status: UserStatus.ACTIVE,
            isPhoneVerified: true, // Auto-verified
        });

        // Generate tokens directly
        const tokens = await this.generateTokens(user);

        // Save refresh token
        user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
        await user.save();

        return {
            message: 'User registered successfully',
            user,
            ...tokens,
        };
    }

    /**
     * Login with phone number
     */
    async login(loginDto: LoginDto) {
        const { phone } = loginDto;

        // Find or create user
        let user = await this.userModel.findOne({ phone });

        if (!user) {
            // Auto-create user on login if not found
            user = await this.userModel.create({
                phone,
                name: `User-${phone.slice(-4)}`,
                status: UserStatus.ACTIVE,
                isPhoneVerified: true, // Auto-verified
            });
        }

        if (user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException('Your account is not active. Please contact support.');
        }

        // Generate tokens directly
        const tokens = await this.generateTokens(user);

        // Save refresh token
        user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
        await user.save();

        return {
            message: 'Login successful',
            user,
            ...tokens,
        };
    }

    /**
     * Verify OTP and issue JWT tokens
     */
    async verifyOTP(verifyOtpDto: VerifyOtpDto) {
        const { phone, otp } = verifyOtpDto;

        // Verify OTP
        const isValid = await this.validateOTP(phone, otp);
        if (!isValid) {
            throw new UnauthorizedException('Invalid or expired OTP');
        }

        // Find user
        const user = await this.userModel.findOne({ phone });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Mark phone as verified
        if (!user.isPhoneVerified) {
            user.isPhoneVerified = true;
            await user.save();
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Save refresh token
        user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
        await user.save();

        return {
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                role: user.role,
                profilePhoto: user.profilePhoto,
            },
            ...tokens,
        };
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshTokenDto: RefreshTokenDto) {
        const { refreshToken } = refreshTokenDto;

        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });

            const user = await this.userModel.findById(payload.sub);
            if (!user || !user.refreshToken) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Verify refresh token matches stored hash
            const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
            if (!isValid) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Generate new tokens
            const tokens = await this.generateTokens(user);

            // Update refresh token
            user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
            await user.save();

            return tokens;
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    /**
     * Logout user
     */
    async logout(userId: string) {
        await this.userModel.findByIdAndUpdate(userId, {
            refreshToken: null,
            deviceToken: null,
        });

        return { message: 'Logout successful' };
    }

    /**
     * Generate OTP for phone number
     */
    private async generateOTP(phone: string): Promise<string> {
        const secret = this.configService.get('OTP_SECRET');
        const otp = authenticator.generate(secret + phone);

        // Store OTP with expiration (5 minutes)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        this.otpCache.set(phone, { otp, expiresAt });

        // Clean up expired OTPs periodically
        this.cleanupExpiredOTPs();

        return otp;
    }

    /**
     * Validate OTP
     */
    private async validateOTP(phone: string, otp: string): Promise<boolean> {
        const cached = this.otpCache.get(phone);

        if (!cached) {
            return false;
        }

        if (new Date() > cached.expiresAt) {
            this.otpCache.delete(phone);
            return false;
        }

        const isValid = cached.otp === otp;

        if (isValid) {
            this.otpCache.delete(phone);
        }

        return isValid;
    }

    /**
     * Generate JWT access and refresh tokens
     */
    private async generateTokens(user: UserDocument) {
        const payload = {
            sub: user._id,
            phone: user.phone,
            role: user.role,
        };

        const accessToken = this.jwtService.sign(payload);

        const refreshToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
        };
    }

    /**
     * Send SMS (mock or real)
     * In production, integrate with SMS providers like Twilio, Msg91, etc.
     */
    private async sendSMS(phone: string, message: string): Promise<void> {
        // In production, integrate with SMS provider:
        // - Twilio: await twilioClient.messages.create({ to: phone, from: twilioNumber, body: message })
        // - Msg91: await msg91.sendSMS({ mobile: phone, message })
        // - AWS SNS: await snsClient.publish({ PhoneNumber: phone, Message: message })

        // For development/demo, log the SMS
        this.logger.log(`[SMS Service] Sending to ${phone}: ${message}`);

        // Simulate SMS delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Clean up expired OTPs
     */
    private cleanupExpiredOTPs() {
        const now = new Date();
        for (const [phone, data] of this.otpCache.entries()) {
            if (now > data.expiresAt) {
                this.otpCache.delete(phone);
            }
        }
    }
}
