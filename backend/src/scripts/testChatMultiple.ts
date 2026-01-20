/**
 * Test multiple chat queries to verify the AI understands different question types
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

const testQueries = [
  '¿Cuántas facturas tengo este año?',
  '¿Cuál es mi cliente más importante?',
  '¿Cuánto IVA tengo que pagar este trimestre?',
];

async function testMultipleQueries() {
  console.log('🧪 Testing Multiple Chat Queries\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // Login
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'test@migestor.com',
      password: 'Test123456'
    });
    const token = loginResponse.data.data?.token || loginResponse.data.token;
    console.log('   ✅ Logged in\n');

    // Test each query
    for (let i = 0; i < testQueries.length; i++) {
      const question = testQueries[i];
      console.log(`\n📝 Query ${i + 1}: "${question}"`);
      console.log('-'.repeat(60));
      
      try {
        const chatResponse = await axios.post(
          `${API_BASE}/chat`,
          { messages: [{ role: 'user', content: question }] },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
        );

        if (chatResponse.data.success) {
          const answer = chatResponse.data.data.message.content;
          // Print first 500 chars of response
          console.log('✅ Response:', answer.substring(0, 500) + (answer.length > 500 ? '...' : ''));
        } else {
          console.log('❌ Failed:', chatResponse.data.error);
        }
      } catch (error: any) {
        console.log('❌ Error:', error.response?.data?.error || error.message);
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ All queries completed!\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testMultipleQueries();
