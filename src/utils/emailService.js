// src/utils/emailService.js
const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  // Option 1: SMTP (Gmail, Outlook, etc.)
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  
  
  
  // Fallback: Console log (for development)
  console.warn('No email transport configured. Emails will be logged to console.');
  return {
    sendMail: (options) => {
      console.log('📧 Email would be sent:', options);
      return Promise.resolve({ messageId: 'mock-message-id' });
    }
  };
};

const transporter = createTransporter();

// Send verification email
exports.sendVerificationEmail = async (email, token, doctorName) => {
  try {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/doctors/verify-email?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Patient Follow-Up" <noreply@patientfollowup.com>',
      to: email,
      subject: 'Verify Your Email - Patient Follow-Up System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { 
              display: inline-block; 
              background: #4F46E5; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 5px; 
              font-weight: bold;
              margin: 20px 0;
            }
            .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Patient Follow-Up System</h1>
            </div>
            <div class="content">
              <h2>Hello ${doctorName || 'Doctor'},</h2>
              <p>Thank you for registering with the Patient Follow-Up System. Please verify your email address to activate your account.</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 4px;">
                ${verificationUrl}
              </p>
              
              <p>This verification link will expire in 24 hours.</p>
              
              <p>If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Patient Follow-Up System. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${doctorName || 'Doctor'},\n\nPlease verify your email by clicking this link: ${verificationUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, please ignore this email.`
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`📧 Verification email sent to ${email}:`, info.messageId);
    
    // For Ethereal email in development
    if (process.env.NODE_ENV === 'development' && info.response?.includes('ethereal.email')) {
      console.log(`📨 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email (after verification)
exports.sendWelcomeEmail = async (email, doctorName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Patient Follow-Up" <noreply@patientfollowup.com>',
      to: email,
      subject: 'Welcome to Patient Follow-Up System!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Welcome to Patient Follow-Up System!</h2>
          <p>Hello ${doctorName},</p>
          <p>Your email has been successfully verified and your account is now active.</p>
          <p>You can now login to your dashboard and start managing your patient follow-ups.</p>
          <p>Features you can use:</p>
          <ul>
            <li>Track overdue patients</li>
            <li>Send automated reminders</li>
            <li>Monitor patient follow-up status</li>
            <li>Generate follow-up reports</li>
          </ul>
          <p>If you have any questions, please contact our support team.</p>
          <br>
          <p>Best regards,<br>Patient Follow-Up Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Welcome email sent to ${email}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, token, doctorName) => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/doctors/reset-password?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Patient Follow-Up" <noreply@patientfollowup.com>',
      to: email,
      subject: 'Reset Your Password - Patient Follow-Up System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Password Reset Request</h2>
          <p>Hello ${doctorName},</p>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <a href="${resetUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Reset Password
          </a>
          <p>Or copy this link: ${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email.</p>
          <br>
          <p>Best regards,<br>Patient Follow-Up Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Password reset email sent to ${email}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};