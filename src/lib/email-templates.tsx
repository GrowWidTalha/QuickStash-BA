import React from 'react';

interface WelcomeEmailProps {
  userName: string;
  userEmail: string;
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({ userName, userEmail }) => {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Welcome to QuickStash!</title>
        <style>
          {`
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #fefcf5; /* Brand Background */
            }
            .container {
              background-color: #ffffff;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
              overflow: hidden;
            }
            .header {
              background: #2e3c4b; /* Brand Primary */
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              margin-bottom: 10px;
              letter-spacing: -0.5px;
            }
            .tagline {
              font-size: 16px;
              opacity: 0.9;
              margin: 0;
            }
            .content {
              padding: 40px 30px;
            }
            .welcome-title {
              font-size: 28px;
              font-weight: 600;
              color: #2e3c4b; /* Brand Primary */
              margin: 0 0 20px 0;
              text-align: center;
            }
            .welcome-text {
              font-size: 16px;
              color: #4a5568;
              margin-bottom: 30px;
              text-align: center;
            }
            .features {
              margin: 30px 0;
            }
            .feature {
              display: flex;
              align-items: center;
              margin-bottom: 20px;
              padding: 15px;
              background-color: #ffe8b9; /* Brand Secondary */
              border-radius: 8px;
              border-left: 4px solid #2e3c4b; /* Brand Primary */
            }
            .feature-icon {
              font-size: 24px;
              margin-right: 15px;
              width: 40px;
              text-align: center;
            }
            .feature-text {
              flex: 1;
            }
            .feature-title {
              font-weight: 600;
              color: #2e3c4b; /* Brand Primary */
              margin: 0 0 5px 0;
              font-size: 16px;
            }
            .feature-description {
              color: #718096;
              margin: 0;
              font-size: 14px;
            }
            .cta-button {
              display: inline-block;
              background: #2e3c4b; /* Brand Primary */
              color: #ffffff;
              text-decoration: none;
              padding: 16px 32px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              text-align: center;
              margin: 30px auto;
              display: block;
              width: fit-content;
              transition: transform 0.2s ease;
            }
            .cta-button:hover {
              transform: translateY(-2px);
            }
            .footer {
              background-color: #fefcf5; /* Brand Background */
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .footer-text {
              color: #718096;
              font-size: 14px;
              margin: 0 0 15px 0;
            }
            .social-links {
              margin-top: 20px;
            }
            .social-link {
              display: inline-block;
              margin: 0 10px;
              color: #2e3c4b; /* Brand Primary */
              text-decoration: none;
              font-size: 14px;
            }
            .divider {
              height: 1px;
              background-color: #ffe8b9; /* Brand Secondary */
              margin: 30px 0;
            }
            @media (max-width: 600px) {
              body {
                padding: 10px;
              }
              .header, .content, .footer {
                padding: 20px;
              }
              .welcome-title {
                font-size: 24px;
              }
              .logo {
                font-size: 28px;
              }
            }
          `}
        </style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <div className="logo">⚡ QuickStash</div>
            <p className="tagline">Save & organize your web content instantly</p>
          </div>
          
          <div className="content">
            <h1 className="welcome-title">Welcome to QuickStash, {userName}! 🎉</h1>
            <p className="welcome-text">
              We're thrilled to have you join our community of content savers and organizers. 
              You're about to discover a powerful way to capture, organize, and access your favorite web content.
            </p>
            
            <div className="features">
              <div className="feature">
                <div className="feature-icon">🚀</div>
                <div className="feature-text">
                  <h3 className="feature-title">Lightning Fast Saving</h3>
                  <p className="feature-description">Save articles, links, and content with a single click</p>
                </div>
              </div>
              
              <div className="feature">
                <div className="feature-icon">📚</div>
                <div className="feature-text">
                  <h3 className="feature-title">Smart Organization</h3>
                  <p className="feature-description">Automatically categorize and tag your saved content</p>
                </div>
              </div>
              
              <div className="feature">
                <div className="feature-icon">🔍</div>
                <div className="feature-text">
                  <h3 className="feature-title">Powerful Search</h3>
                  <p className="feature-description">Find anything you've saved in seconds with intelligent search</p>
                </div>
              </div>
            </div>
            
            <div className="divider"></div>
            
            <a href="com.quickstash.app" className="cta-button">
              Start Building Your Stash →
            </a>
            
            <p style={{ textAlign: 'center', color: '#718096', fontSize: '14px', marginTop: '30px' }}>
              Need help getting started? Check out our <a href="https://quickstash.pro/" style={{ color: '#667eea' }}>getting started guide</a> or 
              reply to this email with any questions!
            </p>
          </div>
          
          <div className="footer">
            <p className="footer-text">
              You're receiving this email because you signed up for QuickStash with {userEmail}
            </p>
            <div className="social-links">
              <a href="https://x.com/Quick_Stash" className="social-link">X/Twitter</a>
              <a href="https://www.instagram.com/quick.stash/" className="social-link">Instagram</a>
              <a href="https://www.linkedin.com/company/quickstash-save-now-read-later/" className="social-link">LinkedIn</a>
            </div>
            <p style={{ color: '#a0aec0', fontSize: '12px', marginTop: '20px' }}>
              © 2024 QuickStash. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
};

export default WelcomeEmail;
