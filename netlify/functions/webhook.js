const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// ربط قاعدة بيانات Supabase تلقائياً من متغيرات البيئة
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// إعدادات الإدارة وواتساب
const MY_NUMBER = '249901815039'; 
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

exports.handler = async (event, context) => {
    // 1. التحقق من الـ Webhook عند الربط (Verification)
    if (event.httpMethod === 'GET') {
        const mode = event.queryStringParameters['hub.mode'];
        const token = event.queryStringParameters['hub.verify_token'];
        const challenge = event.queryStringParameters['hub.challenge'];
        
        const verifyToken = process.env.VERIFY_TOKEN || 'RAIZ3Y_TOKEN';
        if (mode && token === verifyToken) {
            return { statusCode: 200, body: challenge };
        }
        return { statusCode: 403, body: 'Forbidden' };
    }

    // 2. استقبال الرسائل من العميل (POST)
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            
            if (!body.entry || !body.entry[0].changes || !body.entry[0].changes[0].value.messages) {
                return { statusCode: 200, body: 'EVENT_RECEIVED' };
            }

            const messageData = body.entry[0].changes[0].value.messages[0];
            const senderNumber = messageData.from;
            const messageType = messageData.type;
            const isGroup = messageData.chat_id && messageData.chat_id.includes('-'); 

            if (isGroup) {
                return { statusCode: 200, body: 'GROUP_IGNORE' };
            }

            let { data: session } = await supabase
                .from('customer_sessions')
                .select('*')
                .eq('phone_number', senderNumber)
                .single();

            let { data: rateData } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'dollar_rate')
                .single();
            const dollarRate = parseFloat(rateData?.value || 2000);

            if (senderNumber === MY_NUMBER && messageType === 'text') {
                const adminText = messageData.text.body.trim();

                if (adminText.startsWith('تحديث الدولار')) {
                    const newRate = adminText.split(' ')[2];
                    if (newRate && !isNaN(newRate)) {
                        await supabase.from('settings').upsert({ key: 'dollar_rate', value: newRate });
                        await sendWhatsAppMessage(MY_NUMBER, `✅ تم تحديث سعر الدولار بنجاح إلى: ${newRate}`);
                        return { statusCode: 200, body: 'RATE_UPDATED' };
                    }
                }

                if (adminText.startsWith('اغلاق')) {
                    const clientNum = adminText.split(' ')[1];
                    if (clientNum) {
                        await supabase.from('customer_sessions').upsert({ phone_number: clientNum, status: 'bot' });
                        await sendWhatsAppMessage(MY_NUMBER, `✅ تم إغلاق التذكرة للرقم ${clientNum} وإعادة تشغيل البوت له.`);
                        await sendWhatsAppMessage(clientNum, `🌟 شكراً لتواصلك معنا. تم إنهاء المحادثة مع الموظف وإعادة تشغيل البوت التلقائي لخدمتك.`);
                        return { statusCode: 200, body: 'TICKET_CLOSED' };
                    }
                }
            }

            if (session && session.status === 'support') {
                return { statusCode: 200, body: 'SUPPORT_MODE' };
            }

            if (messageType === 'text') {
                const userText = messageData.text.body.toLowerCase().trim();

                if (userText === 'مرحبا' || userText === 'سلام' || userText === 'البداية' || userText === 'بوت') {
                    const welcomeMsg = `🌟 أهلاً بك في متجر 𝐑𝐀𝐈𝐙3𝐘 𝐒𝐓𝐎𝐑𝐄 🌟\n\n` +
                                       `أسعار اليوم (سعر الدولار: ${dollarRate}):\n` +
                                       `1. 🎮 شحن ببجي موبايل = ${(0.99 * dollarRate).toFixed(0)}\n` +
                                       `6. 📡 اشتراكات ستارلينك وحلولها\n\n` +
                                       `✍️ أرسل رقم الخيار أو اكتب *دعم* للتحدث مع موظف.`;
                    
                    await sendWhatsAppMessage(senderNumber, welcomeMsg);
                    return { statusCode: 200, body: 'WELCOME_SENT' };
                }

                if (userText === 'دعم' || userText === '6' || userText.includes('موظف')) {
                    await supabase.from('customer_sessions').upsert({ phone_number: senderNumber, status: 'support' });
                    await sendWhatsAppMessage(senderNumber, `⏳ تم تحويلك إلى موظف الخدمة. شكراً لانتظارك!`);
                    await sendWhatsAppMessage(MY_NUMBER, `🚨 طلب دعم من: ${senderNumber}`);
                    return { statusCode: 200, body: 'SUPPORT_TRANSITION' };
                }
            }

            if (messageType === 'image') {
                await sendWhatsAppMessage(senderNumber, `📥 تم استلام إشعار التحويل. جاري المعالجة.`);
                return { statusCode: 200, body: 'RECEIPT_RECEIVED' };
            }

        } catch (error) {
            return { statusCode: 500, body: 'Internal Error' };
        }
    }
    return { statusCode: 200, body: 'OK' };
};

async function sendWhatsAppMessage(to, text) {
    try {
        await axios.post(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: { body: text }
        }, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
}
