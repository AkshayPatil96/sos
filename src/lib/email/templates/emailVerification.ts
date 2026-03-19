/**
 * Plain-text and HTML templates for the email verification email.
 */
export const emailVerificationTemplate = {
  subject: 'Verify your email address',
  text(verifyUrl: string, appName: string): string {
    return [
      `Hi,`,
      '',
      'Please verify your email address by clicking the link below (valid for 24 hours):',
      '',
      verifyUrl,
      '',
      `— ${appName}`,
    ].join('\n');
  },
  html(verifyUrl: string, appName: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email address</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #222;">Verify your email address</h2>
  <p>Thank you for signing up! Please verify your email address by clicking the button below. This link is valid for <strong>24 hours</strong>.</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${verifyUrl}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email Address</a>
  </p>
  <p style="word-break: break-all; font-size: 14px; color: #666;">Or copy and paste this link into your browser:<br/>${verifyUrl}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="font-size: 12px; color: #999;">If you did not create an account with ${appName}, you can safely ignore this email.</p>
  <p style="font-size: 12px; color: #999;">— ${appName}</p>
</body>
</html>
    `.trim();
  },
};
