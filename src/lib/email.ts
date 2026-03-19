import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { config } from '@/shared/config';
import { logger } from '@/shared/utils/logger';
import { passwordResetTemplate } from './email/templates/passwordReset';
import { emailVerificationTemplate } from './email/templates/emailVerification';
import { inviteTemplate } from './email/templates/invite';

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

  async sendPasswordResetEmail(to: string, _name: string, resetUrl: string): Promise<void> {
    const { subject, text, html } = passwordResetTemplate;
    await this.send(to, subject, text(resetUrl, config.APP_NAME), html(resetUrl, config.APP_NAME));
  }

  async sendEmailVerificationEmail(to: string, _name: string, verifyUrl: string): Promise<void> {
    const { subject, text, html } = emailVerificationTemplate;
    await this.send(
      to,
      subject,
      text(verifyUrl, config.APP_NAME),
      html(verifyUrl, config.APP_NAME),
    );
  }

  async sendInviteEmail(to: string, _name: string, setPasswordUrl: string): Promise<void> {
    const { subject, text, html } = inviteTemplate;
    await this.send(
      to,
      `${subject} ${config.APP_NAME}`,
      text(setPasswordUrl, config.APP_NAME),
      html(setPasswordUrl, config.APP_NAME),
    );
  }

  private async send(
    to: string,
    subject: string,
    textBody: string,
    htmlBody?: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new SendEmailCommand({
          Source: this.fromAddress,
          Destination: { ToAddresses: [to] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: textBody, Charset: 'UTF-8' },
              ...(htmlBody ? { Html: { Data: htmlBody, Charset: 'UTF-8' } } : {}),
            },
          },
        }),
      );
    } catch (err) {
      logger.error('Failed to send email', { to, subject, error: err });
      throw err;
    }
  }
}

export const emailService: IEmailService = new SESEmailService();
