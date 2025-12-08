import { IsString, IsNotEmpty, IsPhoneNumber, IsEmail, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ example: '+919876543210' })
    @IsPhoneNumber()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: 'Jane Doe' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'jane@example.com', required: false })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty({ example: '123456789012', required: false })
    @IsString()
    @IsOptional()
    @Length(12, 12)
    aadharNumber?: string;

    @ApiProperty({ example: 25, required: false })
    @IsOptional()
    age?: number;
}

export class LoginDto {
    @ApiProperty({ example: '+919876543210' })
    @IsPhoneNumber()
    @IsNotEmpty()
    phone: string;
}

export class VerifyOtpDto {
    @ApiProperty({ example: '+919876543210' })
    @IsPhoneNumber()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @IsNotEmpty()
    @Length(6, 6)
    otp: string;
}

export class RefreshTokenDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}
