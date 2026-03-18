import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { config } from '@/shared/config';
import { logger } from '@/shared/utils/logger';

/**
 * Email service contract. All auth email sending goes through this interface.
 * Swap the implementation (e.g. to Nodemailer) without touching any module code.
 */
export interface IEmailService {
  sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void>;
  sendEmailVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void>;
  sendInviteEmail(to: string, name: string, setPasswordUrl: string): Promise<void>;
}

class SESEmailService implements IEmailService {
  private readonly client: SESClient;
  private readonly fromAddress: string;

  constructor() {
    this.client = new SESClient({ region: config.AWS_REGION });
    this.fromAddress = config.SES_FROM_EMAIL
      ? `${config.SES_FROM_NAME} <${config.SES_FROM_EMAIL}>`
      : `${config.SES_FROM_NAME} <noreply@example.com>`;
  }

  /**
   * Sends a password reset email with a tokenised link.
   */
  async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
    const body = [
      `Hi ${name},`,
      '',
      'We received a request to reset your password.',
      'Click the link below to set a new password (valid for 60 minutes):',
      '',
      resetUrl,
      '',
      'If you did not request this, you can safely ignore this email.',
      '',
      `— ${config.SES_FROM_NAME}`,
    ].join('\n');

    await this.send(to, 'Reset your password', body);
  }

  /**
   * Sends an email verification link.
   */
  async sendEmailVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void> {
    const body = [
      `Hi ${name},`,
      '',
      'Please verify your email address by clicking the link below (valid for 24 hours):',
      '',
      verifyUrl,
      '',
      `— ${config.SES_FROM_NAME}`,
    ].join('\n');

    await this.send(to, 'Verify your email address', body);
  }

  /**
   * Sends an invite email so the user can set their initial password.
   */
  async sendInviteEmail(to: string, name: string, setPasswordUrl: string): Promise<void> {
    const body = [
      `Hi ${name},`,
      '',
      `Your account has been created on ${config.SES_FROM_NAME}.`,
      'Click the link below to set your password and activate your account (valid for 72 hours):',
      '',
      setPasswordUrl,
      '',
      `— ${config.SES_FROM_NAME}`,
    ].join('\n');

    await this.send(to, `You're invited to ${config.SES_FROM_NAME}`, body);
  }

  private async send(to: string, subject: string, body: string): Promise<void> {
    try {
      await this.client.send(
        new SendEmailCommand({
          Source: this.fromAddress,
          Destination: { ToAddresses: [to] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Text: { Data: body, Charset: 'UTF-8' } },
          },
        }),
      );
    } catch (error) {
      logger.error('Failed to send email', { to, subject, error });
      throw error;
    }
  }
}

export const emailService: IEmailService = new SESEmailService();
