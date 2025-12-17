// utils/mailer.js
const nodemailer = require('nodemailer');

// Create reusable transporter object
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter is ready
transporter.verify((error, success) => {
  if (error) {
    console.error('Mailer not ready:', error);
  } else {
    console.log('Mailer is ready to send messages');
  }
});

// Send security alert email
const sendSecurityAlert = async (subject, text) => {
  try {
    const mailOptions = {
      from: `"RentVerse Security" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || 'admin@rentverse.com',
      subject: `🚨 ${subject}`,
      text: text,
      html: `<p style="font-size: 16px; line-height: 1.5;">${text.replace(/\n/g, '<br>')}</p>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Security alert sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send security alert:', error);
    throw error;
  }
};

// Send general email (for future use)
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `"RentVerse" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

module.exports = {
  sendSecurityAlert,
  sendEmail,
};