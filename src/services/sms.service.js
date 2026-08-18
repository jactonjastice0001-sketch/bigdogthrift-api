const africastalking = require('africastalking');
const { parsePhoneNumber } = require('libphonenumber-js');

if (!process.env.AFRICAS_TALKING_API_KEY || !process.env.AFRICAS_TALKING_USERNAME) {
    throw new Error('Africa\'s Talking credentials missing from environment. Check AFRICAS_TALKING_API_KEY and AFRICAS_TALKING_USERNAME in .env');
}

const africasTalking = africastalking({
    apiKey: process.env.AFRICAS_TALKING_API_KEY,
    username: process.env.AFRICAS_TALKING_USERNAME
});

const sms = africasTalking.SMS;
const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || 'KE';

const parseNumber = (phoneNumber, countryCode = null) => {
    if (!phoneNumber) return null;
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    try {
        const parsed = cleaned.startsWith('+')
            ? parsePhoneNumber(cleaned)
            : parsePhoneNumber(cleaned, countryCode || DEFAULT_COUNTRY);
        if (!parsed || !parsed.isValid()) return null;
        return parsed;
    } catch (error) {
        return null;
    }
};

const formatPhoneNumber = (phoneNumber, countryCode = null) => {
    const parsed = parseNumber(phoneNumber, countryCode);
    if (!parsed) {
        throw new Error('Could not parse phone number. Please use international format (+254...) or specify a valid country code');
    }
    return parsed.format('E.164');
};

const validatePhoneNumber = (phoneNumber, countryCode = null) => {
    const parsed = parseNumber(phoneNumber, countryCode);
    if (!parsed) {
        return { valid: false, error: 'Could not parse or validate phone number' };
    }
    return {
        valid: true,
        country: parsed.country,
        nationalNumber: parsed.nationalNumber,
        e164: parsed.format('E.164'),
        error: null
    };
};

const sendSMS = async (phoneNumber, message, countryCode = null) => {
    try {
        if (!phoneNumber || !message) {
            return { success: false, error: 'Phone number and message are required' };
        }
        if (message.length > 160) {
            console.warn('Message exceeds 160 characters, will be sent as multiple SMS');
        }
        const parsed = parseNumber(phoneNumber, countryCode);
        if (!parsed) {
            return { success: false, error: 'Invalid phone number', details: { phoneNumber, countryCode } };
        }
        const formattedNumber = parsed.format('E.164');
        console.log(`Sending SMS to: ${formattedNumber} (${parsed.country})`);
        const options = { to: [formattedNumber], message: message };
        const response = await sms.send(options);
        console.log('SMS API Response:', JSON.stringify(response, null, 2));
        if (response.SMSMessageData && response.SMSMessageData.Recipients) {
            const recipients = response.SMSMessageData.Recipients;
            const allSuccessful = recipients.every(r => r.status === 'Success');
            if (allSuccessful) {
                return { success: true, data: response, country: parsed.country, formattedNumber, message: `SMS sent successfully to ${recipients.length} recipient(s)` };
            } else {
                const failedRecipients = recipients.filter(r => r.status !== 'Success');
                return { success: false, error: `Failed to send to ${failedRecipients.length} recipient(s)`, data: response, country: parsed.country, failedRecipients };
            }
        }
        return { success: false, error: 'Unexpected response format from Africa\'s Talking', data: response };
    } catch (error) {
        console.error('SMS sending failed:', error);
        return { success: false, error: error.message || 'Unknown error occurred', details: error.response?.data || null };
    }
};

const sendBulkSMS = async (phoneNumbers, message, countryCode = null) => {
    try {
        if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
            return { success: false, error: 'Valid phone numbers array is required' };
        }
        const validNumbers = [];
        const errors = [];
        for (const number of phoneNumbers) {
            const parsed = parseNumber(number, countryCode);
            if (parsed) {
                validNumbers.push({ original: number, formatted: parsed.format('E.164'), country: parsed.country });
            } else {
                errors.push({ number, error: 'Invalid phone number' });
            }
        }
        if (validNumbers.length === 0) {
            return { success: false, error: 'No valid phone numbers found', errors };
        }
        const formattedNumbers = validNumbers.map(v => v.formatted);
        const countryCounts = {};
        validNumbers.forEach(v => { countryCounts[v.country] = (countryCounts[v.country] || 0) + 1; });
        const options = { to: formattedNumbers, message: message };
        const response = await sms.send(options);
        if (response.SMSMessageData && response.SMSMessageData.Recipients) {
            const recipients = response.SMSMessageData.Recipients;
            const successful = recipients.filter(r => r.status === 'Success');
            const failed = recipients.filter(r => r.status !== 'Success');
            return { success: failed.length === 0, total: recipients.length, successful: successful.length, failed: failed.length, data: response, countryCounts, errors: errors.length > 0 ? errors : undefined, failedRecipients: failed.length > 0 ? failed : undefined };
        }
        return { success: true, data: response, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
        console.error('Bulk SMS sending failed:', error);
        return { success: false, error: error.message, details: error.response?.data || null };
    }
};

const sendSMSWithRetry = async (phoneNumber, message, maxRetries = 3, countryCode = null) => {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await sendSMS(phoneNumber, message, countryCode);
        if (result.success) return result;
        lastError = result.error;
        if (attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return { success: false, error: `Failed after ${maxRetries} attempts: ${lastError}` };
};

const sendOrderStatusUpdate = async (phoneNumber, orderId, status, countryCode = null) => {
    const message = `Your order #${orderId} status has been updated to: ${status}. Thank you for shopping with Thrift Shop!`;
    return await sendSMS(phoneNumber, message, countryCode);
};

const sendOrderConfirmation = async (phoneNumber, orderId, items, countryCode = null) => {
    const message = `Order #${orderId} confirmed! Items: ${items}. We'll notify you when it's ready.`;
    return await sendSMS(phoneNumber, message, countryCode);
};

const sendDeliveryNotification = async (phoneNumber, orderId, countryCode = null) => {
    const message = `Your order #${orderId} is out for delivery! Keep your phone nearby.`;
    return await sendSMS(phoneNumber, message, countryCode);
};

module.exports = {
    sendSMS,
    sendSMSWithRetry,
    sendBulkSMS,
    sendOrderStatusUpdate,
    sendOrderConfirmation,
    sendDeliveryNotification,
    formatPhoneNumber,
    validatePhoneNumber,
    DEFAULT_COUNTRY
};
