import { Resend } from 'resend';
import { config } from '@/lib/config';
// Use Resend's built-in React rendering to avoid importing react-dom/server
import React from 'react';
import { WelcomeEmail } from '@/lib/email-templates';

const resend = new Resend(config.resendApiKey);

export interface WelcomeEmailData {
  email: string;
  name: string;
  userId?: string;
}

export interface EmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Sends a beautiful branded welcome email to a new user
 * @param data - User data including email, name, and optional userId
 * @returns Promise<EmailResult> - Result of the email sending operation
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<EmailResult> {
  try {
    const { email, name, userId } = data;

    // Validate required fields
    if (!email || !name) {
      return {
        success: false,
        error: 'Email and name are required',
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: 'Invalid email format',
      };
    }

    // Check if Resend API key is configured
    if (!config.resendApiKey) {
      return {
        success: false,
        error: 'Resend API key not configured',
      };
    }

    // Send the welcome email using React component directly
    const { data: resendData, error } = await resend.emails.send({
      from: 'QuickStash <noreply@quickstash.pro>', // Replace with your verified domain
      to: [email],
      subject: `Welcome to QuickStash, ${name}! 🎉`,
      react: React.createElement(WelcomeEmail, {
        userName: name,
        userEmail: email,
      }),
      // Optional: Add text version for better email client compatibility
      text: `Welcome to QuickStash, ${name}!

We're thrilled to have you join our community of content savers and organizers.

Here's what you can do with QuickStash:
🚀 Lightning Fast Saving - Save articles, links, and content with a single click
📚 Smart Organization - Automatically categorize and tag your saved content  
🔍 Powerful Search - Find anything you've saved in seconds with intelligent search
📱 Cross-Platform Access - Access your stash from anywhere, on any device


Need help? Check out our getting started guide: https://quickstash.pro/

Best regards,
The QuickStash Team`,
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        success: false,
        error: `Failed to send email: ${error.message}`,
      };
    }

    // Log successful email send (optional)
    console.log(`Welcome email sent successfully to ${email}`, {
      emailId: resendData?.id,
      userId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      emailId: resendData?.id,
    };

  } catch (error) {
    console.error('Error sending welcome email:', error);
    return {
      success: false,
      error: 'Internal server error',
    };
  }
}

/**
 * Utility function to send welcome email via API endpoint
 * Useful for client-side calls
 */
export async function sendWelcomeEmailViaAPI(data: WelcomeEmailData): Promise<EmailResult> {
  try {
    const response = await fetch('/api/send-welcome-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to send email',
      };
    }

    return {
      success: true,
      emailId: result.emailId,
    };

  } catch (error) {
    console.error('Error calling welcome email API:', error);
    return {
      success: false,
      error: 'Network error',
    };
  }
}
