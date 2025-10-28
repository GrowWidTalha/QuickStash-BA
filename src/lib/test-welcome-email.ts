import { sendWelcomeEmail } from '@/lib/welcome-email';

/**
 * Test utility to send a welcome email
 * Usage: Call this function to test the welcome email functionality
 */
export async function testWelcomeEmail() {
  const testData = {
    email: 'test@example.com', // Replace with your test email
    name: 'Test User',
    userId: 'test-user-id',
  };

  console.log('🧪 Testing welcome email...');
  console.log('📧 Sending to:', testData.email);
  
  const result = await sendWelcomeEmail(testData);
  
  if (result.success) {
    console.log('✅ Welcome email sent successfully!');
    console.log('📧 Email ID:', result.emailId);
  } else {
    console.log('❌ Failed to send welcome email:');
    console.log('🚨 Error:', result.error);
  }
  
  return result;
}

// Uncomment the line below to run the test
// testWelcomeEmail();
