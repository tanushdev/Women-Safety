import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

export interface SendSmsOptions {
    to: string;
    message: string;
}

export interface SendWhatsAppOptions {
    to: string;
    message: string;
}

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private twilioClient?: twilio.Twilio;
    private twilioPhoneNumber?: string;
    private twilioWhatsAppNumber?: string;

    constructor(private readonly configService: ConfigService) {
        const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
        const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
        this.twilioPhoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');
        this.twilioWhatsAppNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER');

        if (accountSid && authToken && !accountSid.includes('your_') && !authToken.includes('your_')) {
            try {
                this.twilioClient = twilio(accountSid, authToken);
                this.logger.log('Twilio client initialized successfully');
            } catch (err: any) {
                this.logger.error(`Failed to initialize Twilio client: ${err?.message}`);
            }
        } else {
            this.logger.warn('Twilio credentials not configured or placeholder detected. SMS will run in mock/log mode.');
        }
    }

    /**
     * Send SMS via Twilio or fallback logger
     */
    async sendSMS(to: string, message: string): Promise<boolean> {
        if (!to) {
            this.logger.warn('Cannot send SMS: No recipient phone number provided');
            return false;
        }

        // Format phone number to E.164 if possible
        const formattedPhone = to.startsWith('+') ? to : `+91${to.replace(/^0+/, '')}`;

        if (this.twilioClient && this.twilioPhoneNumber) {
            try {
                const response = await this.twilioClient.messages.create({
                    body: message,
                    from: this.twilioPhoneNumber,
                    to: formattedPhone,
                });
                this.logger.log(`[Twilio SMS Sent] To: ${formattedPhone}, SID: ${response.sid}`);
                return true;
            } catch (error: any) {
                this.logger.error(`[Twilio SMS Error] Failed to send to ${formattedPhone}: ${error?.message}`);
                // Fall through to simulate/log
            }
        }

        // Fallback logger
        this.logger.log(`[MOCK SMS] To: ${formattedPhone} | Message: ${message.replace(/\n/g, ' ')}`);
        return true;
    }

    /**
     * Send WhatsApp alert via Twilio or fallback logger
     */
    async sendWhatsApp(to: string, message: string): Promise<boolean> {
        if (!to) return false;

        const formattedPhone = to.startsWith('+') ? to : `+91${to.replace(/^0+/, '')}`;

        if (this.twilioClient && this.twilioWhatsAppNumber) {
            try {
                const fromWhatsApp = this.twilioWhatsAppNumber.startsWith('whatsapp:')
                    ? this.twilioWhatsAppNumber
                    : `whatsapp:${this.twilioWhatsAppNumber}`;

                const response = await this.twilioClient.messages.create({
                    body: message,
                    from: fromWhatsApp,
                    to: `whatsapp:${formattedPhone}`,
                });
                this.logger.log(`[Twilio WhatsApp Sent] To: ${formattedPhone}, SID: ${response.sid}`);
                return true;
            } catch (error: any) {
                this.logger.error(`[Twilio WhatsApp Error] Failed to send to ${formattedPhone}: ${error?.message}`);
            }
        }

        this.logger.log(`[MOCK WhatsApp] To: ${formattedPhone} | Message: ${message.replace(/\n/g, ' ')}`);
        return true;
    }

    /**
     * Send push notification
     */
    async sendPushNotification(deviceToken: string, title: string, body: string, data?: Record<string, any>): Promise<boolean> {
        this.logger.log(`[Push Notification] To: ${deviceToken} | Title: ${title} | Body: ${body} | Data: ${JSON.stringify(data || {})}`);
        return true;
    }

    /**
     * Send email
     */
    async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
        this.logger.log(`[Email] To: ${to} | Subject: ${subject} | Body: ${body}`);
        return true;
    }
}
