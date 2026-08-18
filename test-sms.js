require('dotenv').config();
const { sendSMS } = require('./src/services/sms.service');

sendSMS('0712345678', 'Test from Thrift Shop')
  .then(result => console.log('Result:', result))
  .catch(err => console.error('Error:', err));
