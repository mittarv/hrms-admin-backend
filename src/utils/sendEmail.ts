import nodemailer from 'nodemailer';
const hbs = require('nodemailer-express-handlebars');
import path from 'path';

const transporter = nodemailer.createTransport({
  service: "sendMail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
});

const handlebarOptions = {
  viewEngine: {
    extName: ".handlebars",
    partialsDir: path.resolve(__dirname, '../views'),
    defaultLayout: false,
  },
  viewPath: path.resolve(__dirname, '../views'),
  extName: ".handlebars",
};

transporter.use('compile', hbs(handlebarOptions));

export const sendSaaSCreationEmail = async (
  email: string,
  subdomain: string,
  domain: string | null,
  organizationName: string,
  adminName: string
) => {
  return new Promise((resolve, reject) => {
    // Construct redirect URL
    let redirectUrl = process.env.REDIRECT_URL;

    if (!redirectUrl) {
      const isLocal = process.env.NODE_ENV !== 'production' || !domain || !domain.includes('.') || domain.includes('localhost') || domain.includes('lvh.me');
      if (isLocal) {
        // For local development, use localhost with tenant parameter
        redirectUrl = `http://localhost:3000/login?tenant=${subdomain}`;
      } else {
        // For production: use real subdomain routing (e.g. mittarv.extindia.com/app/hr)
        redirectUrl = `https://${subdomain}.${domain}/app/hr`;
      }
    }

    transporter.sendMail({
      from: process.env.HRMS_SMTP_FROM,
      replyTo: process.env.HRMS_SMTP_FROM,
      to: email,
      subject: 'Welcome to your new HRMS',
      template: 'saas_onboarding_welcome',
      context: {
        redirectUrl: redirectUrl,
        adminName: adminName,
        organizationName: organizationName,
        email: email,
        year: new Date().getFullYear().toString()
      }
    } as any, (err: any) => {
      if (err) {
        console.error('Failed to send onboarding email:', err);
        reject(new Error(`Failed to send email: ${err.message}`));
      } else {
        console.log('SaaS Onboarding email sent to:', email);
        resolve('Email sent successfully');
      }
    });
  });
};

export const sendInviteEmail = async (
  email: string,
  name: string,
  role: string,
  inviteToken: string,
  organizations: string[] = []
) => {
  return new Promise((resolve, reject) => {
    // Determine the frontend base URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}`;

    transporter.sendMail({
      from: process.env.HRMS_SMTP_FROM,
      replyTo: process.env.HRMS_SMTP_FROM,
      to: email,
      subject: 'Invitation to Join Mittarv Admin',
      template: 'invite_user',
      context: {
        name: name,
        role: role.replace('_', ' '),
        organizations: organizations.length > 0 ? organizations : ['Global Access'],
        inviteLink: inviteLink,
        year: new Date().getFullYear().toString()
      }
    } as any, (err: any) => {
      if (err) {
        console.error('Failed to send invite email:', err);
        reject(new Error(`Failed to send email: ${err.message}`));
      } else {
        console.log('Invite email sent to:', email);
        resolve('Email sent successfully');
      }
    });
  });
};
