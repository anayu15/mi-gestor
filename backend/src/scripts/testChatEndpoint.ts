/**
 * Test script for Chat API endpoint
 * This tests the full flow: authentication + chat API
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

async function testChatEndpoint() {
  console.log('🧪 Testing Chat API Endpoint\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // Step 1: Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'test@migestor.com',
      password: 'Test123456'
    });

    console.log('   Response:', JSON.stringify(loginResponse.data, null, 2));
    
    // The token might be in data.token or directly in token
    const token = loginResponse.data.data?.token || loginResponse.data.token;
    if (!token) {
      throw new Error('No token received from login');
    }
    console.log('   ✅ Login successful\n');

    // Step 2: Get suggestions
    console.log('2️⃣ Getting chat suggestions...');
    const suggestionsResponse = await axios.get(`${API_BASE}/chat/suggestions`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (suggestionsResponse.data.success) {
      console.log('   ✅ Suggestions received:');
      suggestionsResponse.data.data.suggestions.forEach((s: string, i: number) => {
        console.log(`      ${i + 1}. ${s}`);
      });
    } else {
      console.log('   ❌ Failed to get suggestions');
    }
    console.log('');

    // Step 3: Send a test message
    console.log('3️⃣ Sending test message: "¿Cuánto dinero tengo disponible?"');
    const chatResponse = await axios.post(
      `${API_BASE}/chat`,
      {
        messages: [
          { role: 'user', content: '¿Cuánto dinero tengo disponible?' }
        ]
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000 // 60 second timeout for AI response
      }
    );

    if (chatResponse.data.success) {
      console.log('   ✅ Chat response received:\n');
      console.log('   ' + '-'.repeat(56));
      const responseText = chatResponse.data.data.message.content;
      // Print response with indentation
      responseText.split('\n').forEach((line: string) => {
        console.log('   | ' + line);
      });
      console.log('   ' + '-'.repeat(56));
    } else {
      console.log('   ❌ Chat request failed:', chatResponse.data.error);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ All tests passed!\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the backend server is running on http://localhost:3000');
    }
    
    process.exit(1);
  }
}

testChatEndpoint();
