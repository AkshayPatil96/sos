/**
 * Plain-text and HTML templates for the password reset email.
 */
export const passwordResetTemplate = {
  subject: 'Reset your password',
  text(resetUrl: string, appName: string): string {
    return [
      `Hi,`,
      '',
      'We received a request to reset your password.',
      `Click the link below to set a new password (valid for 60 minutes):`,
      '',
      resetUrl,
      '',
      'If you did not request this, you can safely ignore this email.',
      '',
      `— ${appName}`,
    ].join('\n');
  },
  html(resetUrl: string, appName: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #222;">Reset your password</h2>
  <p>We received a request to reset your password for your ${appName} account.</p>
  <p>Click the button below to set a new password. This link is valid for <strong>60 minutes</strong>.</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${resetUrl}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
  </p>
  <p style="word-break: break-all; font-size: 14px; color: #666;">Or copy and paste this link into your browser:<br/>${resetUrl}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="font-size: 12px; color: #999;">If you did not request a password reset, you can safely ignore this email. This link will expire in 60 minutes.</p>
  <p style="font-size: 12px; color: #999;">— ${appName}</p>
</body>
</html>
    `.trim();
  },
};
