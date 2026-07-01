const { createClient } = require('@supabase/supabase-client');
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

            // 🛑 شرط صارم: البوت لا يرد تلقائياً في المجموعات أبداً
            if (isGroup) {
                return { statusCode: 200, body: 'GROUP_IGNORE' };
            }

            // جلب حالة العميل من قاعدة البيانات
            let { data: session } = await supabase
                .from('customer_sessions')
                .select('*')
                .eq('phone_number', senderNumber)
                .single();

            // جلب سعر الدولار الحالي
            let { data: rateData } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'dollar_rate')
                .single();
            const dollarRate = parseFloat(rateData?.value || 2000);

            // 👮‍♂️ إدارة الأوامر من صاحب المتجر (رقمك الخاص)
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

            // ⏳ إذا كانت حالة العميل "تحت دعم الموظف"، يتجاهل البوت الرسالة تماماً لكي تتحدث معه بحرية
            if (session && session.status === 'support') {
                return { statusCode: 200, body: 'SUPPORT_MODE' };
            }

            // 🤖 معالجة ردود البوت التلقائية (الرسائل النصية والقوائم)
            if (messageType === 'text') {
                const userText = messageData.text.body.toLowerCase().trim();

                if (userText === 'مرحبا' || userText === 'سلام' || userText === 'البداية' || userText === 'بوت') {
                    const welcomeMsg = `🌟 أهلاً بك في متجر 𝐑𝐀𝐈𝐙3𝐘 𝐒𝐓𝐎𝐑𝐄 🌟\n\n` +
                                       `بوت الخدمة الذاتية في خدمتك لتلبية طلباتك بسرعة وأمان ⚡.\n\n` +
                                       `أسعار اليوم (سعر الدولار الحالي: ${dollarRate}):\n` +
                                       `1. 🎮 شحن ببجي موبايل (60 UC) = ${(0.99 * dollarRate).toFixed(0)}\n` +
                                       `2. ⚽ شحن بيس فوتبول (100 Coin) = ${(1.2 * dollarRate).toFixed(0)}\n` +
                                       `3. 📱 اشتراكات التطبيقات والمواقع (Netflix) = ${(5 * dollarRate).toFixed(0)}\n` +
                                       `4. 💳 خدمات VISA وبطاقات جوجل بلاي\n` +
                                       `5. 📡 اشتراكات ستارلينك وحلولها\n` +
                                       `6. 🧾 دفع الفواتير وشحن الألعاب عند الطلب\n\n` +
                                       `✍️ للطلب أو الاستفسار، أو للتحدث مع الإدارة مباشرة، أرسل رقم الخيار أو اكتب *دعم* للتحدث مع موظف.`;
                    
                    await sendWhatsAppMessage(senderNumber, welcomeMsg);
                    return { statusCode: 200, body: 'WELCOME_SENT' };
                }

                if (userText === 'دعم' || userText === '6' || userText.includes('موظف')) {
                    await supabase.from('customer_sessions').upsert({ phone_number: senderNumber, status: 'support' });
                    await sendWhatsAppMessage(senderNumber, `⏳ تم إيقاف البوت وتحويلك إلى موظف الخدمة الآن. سيقوم أحد المشرفين بالرد عليك قريباً، شكراً لانتظارك!`);
                    
                    const adminAlert = `🚨 العميل يطلب التحدث مع الموظف!\n👉 رقم العميل: ${senderNumber}\n🔗 للتحدث معه مباشرة اضغط هنا: https://wa.me/${senderNumber}`;
                    await sendWhatsAppMessage(MY_NUMBER, adminAlert);
                    return { statusCode: 200, body: 'SUPPORT_TRANSITION' };
                }

                if (userText === '1') {
                    const localPrice = (0.99 * dollarRate).toFixed(0);
                    await sendWhatsAppMessage(senderNumber, `🎮 لقد اخترت شحن ببجي موبايل.\n💵 السعر الحالي: ${localPrice}\n\nيرجى تحويل المبلغ إلى الحساب البنكي التالي:\n🏦 بنكك: 1234567\n👤 باسم: متجر Raiz3y\n\n🔴 بعد التحويل، يرجى إرسال *صورة إشعار التحويل* هنا فوراً لتأكيد طلبك.`);
                    
                    await supabase.from('orders').insert({
                        phone_number: senderNumber,
                        service_name: 'شحن ببجي موبايل',
                        price_local: localPrice,
                        status: 'pending'
                    });
                    return { statusCode: 200, body: 'ORDER_INITIATED' };
                }
            }

            if (messageType === 'image') {
                await sendWhatsAppMessage(senderNumber, `📥 شكراً لك، تم استلام إشعار التحويل بنجاح. جاري التحقق من عملية الدفع الآن من قبل المشرفين وتنفيذ طلبك في أسرع وقت. ⌛`);
                
                const adminOrderMsg = `💰 طلب جديد قيد التنفيذ!\n👤 من الرقم: ${senderNumber}\n📸 تم إرسال إشعار التحويل بنجاح.\nيرجى مراجعة الحساب البنكي وتنفيذ الطلب، ثم أرسل (اغلاق ${senderNumber}) لإعادة البوت للعميل عند الانتهاء.`;
                await sendWhatsAppMessage(MY_NUMBER, adminOrderMsg);
                return { statusCode: 200, body: 'RECEIPT_RECEIVED' };
            }

        } catch (error) {
            console.error('Error handling webhook:', error);
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
        console.error('Error sending WhatsApp message:', err.response?.data || err.message);
    }
}
