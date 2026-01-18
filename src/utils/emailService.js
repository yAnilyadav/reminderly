// src/utils/emailService.js
const sgMail = require('@sendgrid/mail');

// Set SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not set. Emails will be logged to console.');
}

// Common email footer (CAN-SPAM compliant)
const getEmailFooter = () => {
  const currentYear = new Date().getFullYear();
  const companyAddress = process.env.COMPANY_ADDRESS || 'Your Clinic Address, City, State ZIP, Country';
  
  return `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
      <p>© ${currentYear} Reminderly - Patient Follow-Up System</p>
      <p>${companyAddress}</p>
      <p>
        <a href="[UNSUBSCRIBE_URL]" style="color: #666; text-decoration: none;">Unsubscribe</a> | 
        <a href="mailto:support@patientfollowup.com" style="color: #666; text-decoration: none;">Contact Support</a>
      </p>
      <p style="font-size: 11px; margin-top: 10px;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `;
};

// Send verification email
exports.sendVerificationEmail = async (email, token, doctorName) => {
  try {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/doctors/verify-email?token=${token}`;
    const footer = getEmailFooter();
    
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM || 'Reminderly <noreply@patientfollowup.com>',
      subject: 'Verify Your Email - Patient Follow-Up System',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">Reminderly</h1>
              <p style="margin: 5px 0 0 0;">Patient Follow-Up System</p>
            </div>
            
            <!-- Content -->
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
              <h2 style="color: #333; margin-top: 0;">Hello ${doctorName || 'Doctor'},</h2>
              <p>Thank you for registering with Reminderly. Please verify your email address to activate your account.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p>Or copy and paste this link in your browser:</p>
              <div style="background: #eee; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px;">
                ${verificationUrl}
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                <strong>Note:</strong> This verification link will expire in 24 hours.
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="font-size: 14px; color: #666;">
                If you didn't create an account with Reminderly, please ignore this email.
              </p>
            </div>
            
            ${footer}
          </div>
        </body>
        </html>
      `,
      text: `Hello ${doctorName || 'Doctor'},

Thank you for registering with Reminderly. Please verify your email by clicking this link:
${verificationUrl}

This link expires in 24 hours.

If you didn't create an account with Reminderly, please ignore this email.

---
© ${new Date().getFullYear()} Reminderly - Patient Follow-Up System
${process.env.COMPANY_ADDRESS || 'Your Clinic Address'}
Unsubscribe: [UNSUBSCRIBE_URL]
Contact Support: support@patientfollowup.com`
    };

    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.log('📧 Email would be sent (SendGrid not configured):', {
        to: email,
        subject: msg.subject,
        verificationUrl: verificationUrl
      });
      return { success: true, messageId: 'mock-message-id' };
    }

    const [response] = await sgMail.send(msg);
    console.log(`✅ Verification email sent to ${email}`);
    
    return { 
      success: true, 
      messageId: response.headers['x-message-id'] || 'sent'
    };
    
  } catch (error) {
    console.error('❌ Error sending verification email:', error.response?.body || error.message);
    
    // Fallback to console log if SendGrid fails
    console.log('📧 Email would be sent to:', email);
    console.log('📧 Verification token:', token);
    
    return { 
      success: false, 
      error: error.message,
      fallbackToken: token // Return token for manual verification
    };
  }
};

// Send welcome email (after verification)
exports.sendWelcomeEmail = async (email, doctorName) => {
  try {
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
    const footer = getEmailFooter();
    
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM || 'Reminderly <noreply@patientfollowup.com>',
      subject: 'Welcome to Patient Follow-Up System!',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">Welcome to Reminderly!</h1>
              <p style="margin: 5px 0 0 0;">Your Patient Follow-Up System</p>
            </div>
            
            <!-- Content -->
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
              <h2 style="color: #333; margin-top: 0;">Hello ${doctorName},</h2>
              <p>🎉 Your email has been successfully verified and your account is now active!</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Go to Dashboard
                </a>
              </div>
              
              <p>You can now:</p>
              <ul style="padding-left: 20px;">
                <li>Track overdue patients</li>
                <li>Send automated reminders via SMS/Email</li>
                <li>Monitor patient follow-up status</li>
                <li>Generate follow-up reports</li>
                <li>Manage your patient database</li>
              </ul>
              
              <p style="background: #EFF6FF; padding: 15px; border-radius: 5px; border-left: 4px solid #3B82F6;">
                <strong>Pro Tip:</strong> Set up your patient profiles and start tracking follow-ups immediately!
              </p>
              
              <p>If you have any questions, please contact our support team.</p>
            </div>
            
            ${footer}
          </div>
        </body>
        </html>
      `,
      text: `Hello ${doctorName},

🎉 Welcome to Reminderly! Your email has been verified and your account is now active.

You can now login to your dashboard: ${dashboardUrl}

Features available:
• Track overdue patients
• Send automated reminders via SMS/Email
• Monitor patient follow-up status
• Generate follow-up reports
• Manage your patient database

Pro Tip: Set up your patient profiles and start tracking follow-ups immediately!

If you have any questions, please contact our support team.

---
© ${new Date().getFullYear()} Reminderly - Patient Follow-Up System
${process.env.COMPANY_ADDRESS || 'Your Clinic Address'}
Contact Support: support@patientfollowup.com`
    };

    if (!process.env.SENDGRID_API_KEY) {
      console.log('📧 Welcome email would be sent to:', email);
      return { success: true };
    }

    await sgMail.send(msg);
    console.log(`✅ Welcome email sent to ${email}`);
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
    const footer = getEmailFooter();
    
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM || 'Reminderly <noreply@patientfollowup.com>',
      subject: 'Reset Your Password - Patient Follow-Up System',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">Password Reset</h1>
              <p style="margin: 5px 0 0 0;">Reminderly - Patient Follow-Up System</p>
            </div>
            
            <!-- Content -->
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
              <h2 style="color: #333; margin-top: 0;">Hello ${doctorName},</h2>
              <p>We received a request to reset your password. Click the button below to reset it:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Reset Password
                </a>
              </div>
              
              <p>Or copy and paste this link in your browser:</p>
              <div style="background: #fee; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px; border-left: 4px solid #DC2626;">
                ${resetUrl}
              </div>
              
              <p style="color: #DC2626; font-weight: bold; margin-top: 20px;">
                ⚠️ This link will expire in 1 hour.
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="font-size: 14px; color: #666;">
                <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email. 
                Your password will remain unchanged.
              </p>
              
              <p style="font-size: 14px; color: #666;">
                For security reasons, do not share this email with anyone.
              </p>
            </div>
            
            ${footer}
          </div>
        </body>
        </html>
      `,
      text: `Hello ${doctorName},

We received a request to reset your password. Click the link below to reset it:
${resetUrl}

⚠️ This link will expire in 1 hour.

Security Notice: If you didn't request a password reset, please ignore this email. 
Your password will remain unchanged.

For security reasons, do not share this email with anyone.

---
© ${new Date().getFullYear()} Reminderly - Patient Follow-Up System
${process.env.COMPANY_ADDRESS || 'Your Clinic Address'}
Contact Support: support@patientfollowup.com`
    };

    if (!process.env.SENDGRID_API_KEY) {
      console.log('📧 Password reset email would be sent to:', email);
      console.log('📧 Reset token:', token);
      return { success: true };
    }

    await sgMail.send(msg);
    console.log(`✅ Password reset email sent to ${email}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Test SendGrid connection
exports.testSendGrid = async () => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return { 
        success: false, 
        message: 'SENDGRID_API_KEY not configured',
        suggestion: 'Add SENDGRID_API_KEY to environment variables'
      };
    }

    const msg = {
      to: process.env.TEST_EMAIL || 'test@example.com',
      from: process.env.EMAIL_FROM || 'Reminderly <noreply@patientfollowup.com>',
      subject: 'SendGrid Test - Patient Follow-Up System',
      text: 'If you receive this email, SendGrid is working correctly with Reminderly!',
      html: '<h2>SendGrid Test Successful!</h2><p>Your email configuration is working correctly.</p>'
    };

    await sgMail.send(msg);
    console.log('✅ SendGrid test email sent successfully');
    
    return { 
      success: true, 
      message: 'SendGrid test email sent successfully'
    };
    
  } catch (error) {
    console.error('❌ SendGrid test failed:', error.response?.body || error.message);
    
    return { 
      success: false, 
      error: error.message,
      details: error.response?.body,
      suggestion: 'Check SendGrid API key and verify sender email in SendGrid dashboard'
    };
  }
};

// utils/emailService.js - Add OTP email function
exports.sendOtpEmail = async (email, otpCode, doctorName) => {
    try {
      const footer = getEmailFooter();
      
      const msg = {
        to: email,
        from: process.env.EMAIL_FROM || 'Reminderly <noreply@patientfollowup.com>',
        subject: 'Your Verification Code - Patient Follow-Up System',
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <!-- Header -->
              <div style="background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Reminderly</h1>
                <p style="margin: 5px 0 0 0;">Patient Follow-Up System</p>
              </div>
              
              <!-- Content -->
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
                <h2 style="color: #333; margin-top: 0;">Hello ${doctorName || 'Doctor'},</h2>
                <p>Thank you for registering with Reminderly. Use the OTP below to verify your email address:</p>
                
                <!-- OTP Display -->
                <div style="text-align: center; margin: 40px 0;">
                  <div style="font-size: 48px; font-weight: bold; letter-spacing: 15px; color: #4F46E5; margin: 20px 0;">
                    ${otpCode.split('').join(' ')}
                  </div>
                  <p style="font-size: 18px; color: #666;">Verification Code</p>
                </div>
                
                <!-- Instructions -->
                <div style="background: #EFF6FF; padding: 20px; border-radius: 8px; margin: 30px 0;">
                  <h3 style="color: #1E40AF; margin-top: 0;">How to use this OTP:</h3>
                  <ol style="padding-left: 20px;">
                    <li>Go to the verification page on our app</li>
                    <li>Enter the 4-digit code above</li>
                    <li>Click "Verify Email"</li>
                  </ol>
                </div>
                
                <!-- Security Notes -->
                <div style="background: #FEF2F2; padding: 15px; border-radius: 5px; border-left: 4px solid #DC2626;">
                  <p style="margin: 0; color: #DC2626;">
                    <strong>Security Notice:</strong>
                  </p>
                  <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #666;">
                    <li>This OTP is valid for <strong>10 minutes</strong></li>
                    <li>Do not share this code with anyone</li>
                    <li>If you didn't request this, please ignore this email</li>
                  </ul>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #666;">
                  Need help? Contact our support team.
                </p>
              </div>
              
              ${footer}
            </div>
          </body>
          </html>
        `,
        text: `Hello ${doctorName || 'Doctor'},
  
  Thank you for registering with Reminderly. Use this OTP to verify your email:
  
  🔐 Verification Code: ${otpCode}
  
  This OTP is valid for 10 minutes.
  
  How to use:
  1. Go to the verification page on our app
  2. Enter the 4-digit code above
  3. Click "Verify Email"
  
  Security Notice:
  • This OTP expires in 10 minutes
  • Do not share this code with anyone
  • If you didn't request this, please ignore this email
  
  Need help? Contact our support team.
  
  ---
  © ${new Date().getFullYear()} Reminderly - Patient Follow-Up System
  ${process.env.COMPANY_ADDRESS || 'Your Clinic Address'}
  Contact Support: support@patientfollowup.com`
      };
  
      if (!process.env.SENDGRID_API_KEY) {
        console.log('📧 OTP would be sent to:', email);
        console.log('🔢 OTP Code:', otpCode);
        return { success: true, otp: otpCode };
      }
  
      await sgMail.send(msg);
      console.log(`✅ OTP email sent to ${email}`);
      
      return { 
        success: true, 
        otp: otpCode // Return for development/testing
      };
      
    } catch (error) {
      console.error('❌ Error sending OTP email:', error.response?.body || error.message);
      
      // Fallback: Log OTP for development
      console.log('📧 OTP for', email, ':', otpCode);
      
      return { 
        success: false, 
        error: error.message,
        otp: otpCode // Still return OTP for manual verification
      };
    }
  };