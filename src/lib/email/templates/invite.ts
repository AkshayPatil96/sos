/**
 * Plain-text and HTML templates for the user invite email.
 * Used when an admin creates a new user account.
 */
export const inviteTemplate = {
  subject: `You're invited to`,
  text(setPasswordUrl: string, appName: string): string {
    return [
      `Hi,`,
      '',
      `Your account has been created on ${appName}.`,
      'Click the link below to set your password and activate your account (valid for 72 hours):',
      '',
      setPasswordUrl,
      '',
      `— ${appName}`,
    ].join('\n');
  },
  html(setPasswordUrl: string, appName: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to ${appName}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #222;">You're invited to ${appName}</h2>
  <p>Your account has been created on <strong>${appName}</strong>.</p>
  <p>Click the button below to set your password and activate your account. This link is valid for <strong>72 hours</strong>.</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${setPasswordUrl}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Set Password & Activate Account</a>
  </p>
  <p style="word-break: break-all; font-size: 14px; color: #666;">Or copy and paste this link into your browser:<br/>${setPasswordUrl}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="font-size: 12px; color: #999;">If you did not expect this invitation, please contact your administrator.</p>
  <p style="font-size: 12px; color: #999;">— ${appName}</p>
</body>
</html>
    `.trim();
  },
};
