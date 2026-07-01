const ADMIN_PHONE = '249901815039';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// قاعدة بيانات مؤقتة في الذاكرة
let dollarRate = 5300;
const sessions = {};

const products = {
  pubg: [
    { name: '60 UC', price: 5270 },
    { name: '120 UC', price: 10740 },
    { name: '180 UC', price: 15510 },
    { name: '240 UC', price: 20280 },
    { name: '325 UC', price: 25050 },
    { name: '385 UC', price: 30085 },
    { name: '445 UC', price: 34855 },
    { name: '660 UC', price: 49430 },
    { name: '720 UC', price: 54200 },
    { name: '1045 UC', price: 78315 },
    { name: '1370 UC', price: 102430 },
    { name: '1800 UC', price: 121775 },
    { name: '2460 UC', price: 170005 },
    { name: '3850 UC', price: 242350 },
    { name: '4510 UC', price: 290580 },
    { name: '8100 UC', price: 483500 },
    { name: '16200 UC', price: 965800 },
  ],
  freefire: [
    { name: '110 جوهرة', price: 5747 },
    { name: '231 جوهرة', price: 11194 },
    { name: '583 جوهرة', price: 27182 },
    { name: '1188 جوهرة', price: 53617 },
    { name: '2420 جوهرة', price: 106334 },
  ],
  googleplay: [
    { name: 'بطاقة 5$', price: 34925 },
    { name: 'بطاقة 10$', price: 62750 },
    { name: 'بطاقة 20$', price: 118600 },
    { name: 'بطاقة 50$', price: 285550 },
    { name: 'بطاقة 100$', price: 563800 },
  ],
};

const PAYMENT_INFO = `💳 بيانات الدفع:
الاسم: فايزه الصادق هارون البشاري
رقم الحساب: 2905630
⚠️ التعليق الإلزامي: من اسمك الكريم الى رايزي مقابل خدمه`;

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const p = event.queryStringParameters;
    if (p['hub.mode'] === 'subscribe' && p['hub.verify_token'] === VERIFY_TOKEN) {
      return { statusCode: 200, body: p['hub.challenge'] };
    }
    return { statusCode: 403, body: 'Forbidden' };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!msg) return { statusCode: 200, body: 'OK' };

      const from = msg.from;
      const text = msg.text?.body?.trim() || '';

      // تجاهل المجموعات
      if (msg.to && msg.to.includes('@g.us')) return { statusCode: 200, body: 'OK' };

      // أوامر الإدارة
      if (from === ADMIN_PHONE) {
        if (text.startsWith('دولار ')) {
          const rate = parseInt(text.replace('دولار ', ''));
          if (!isNaN(rate)) {
            dollarRate = rate;
            await send(from, `✅ تم تحديث سعر الدولار إلى ${rate} جنيه`);
            return { statusCode: 200, body: 'OK' };
          }
        }
      }

      await handleSession(from, text);
    } catch (e) {
      console.error('Error:', e.message);
    }
    return { statusCode: 200, body: 'EVENT_RECEIVED' };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};

async function handleSession(from, text) {
  if (!sessions[from]) sessions[from] = { step: 'start' };
  const session = sessions[from];

  if (text === 'رجوع' || text === 'القائمة الرئيسية' || text === 'مرحبا' || text === 'هلا' || text === 'السلام عليكم' || session.step === 'start') {
    session.step = 'main_menu';
    await send(from, `🎮 أهلاً بك في *RAIZEY STORE* 🛒

اختر الخدمة بإرسال الرقم:

1️⃣ شحن ببجي موبايل 🎯
2️⃣ شحن فري فاير 🔥
3️⃣ بطاقات جوجل بلاي 🎁
4️⃣ اشتراكات وخدمات أخرى 📱
5️⃣ التحدث مع الدعم 🙋

اكتب رقم الخدمة المطلوبة ⬇️`);
    return;
  }

  if (session.step === 'main_menu') {
    if (text === '1') { session.step = 'show_products'; session.category = 'pubg'; }
    else if (text === '2') { session.step = 'show_products'; session.category = 'freefire'; }
    else if (text === '3') { session.step = 'show_products'; session.category = 'googleplay'; }
    else if (text === '4') { await send(from, '📱 للاشتراكات والخدمات الأخرى، تواصل معنا مباشرة:\nwa.me/249901815039'); return; }
    else if (text === '5') { await send(from, '🙋 فريق الدعم جاهز لمساعدتك:\nwa.me/249901815039'); return; }
    else { await send(from, '❌ اختيار غير صحيح، أرسل رقم من 1 إلى 5'); return; }
  }

  if (session.step === 'show_products') {
    const list = products[session.category];
    const categoryNames = { pubg: 'ببجي موبايل 🎯', freefire: 'فري فاير 🔥', googleplay: 'جوجل بلاي 🎁' };
    let msg = `${categoryNames[session.category]}\n\nاختر الباقة بإرسال رقمها:\n\n`;
    list.forEach((p, i) => { msg += `${i + 1}️⃣ ${p.name} — ${p.price.toLocaleString()} جنيه\n`; });
    msg += '\n↩️ للرجوع أرسل "رجوع"';
    await send(from, msg);
    session.step = 'select_product';
    return;
  }

  if (session.step === 'select_product') {
    const list = products[session.category];
    const idx = parseInt(text) - 1;
    if (isNaN(idx) || idx < 0 || idx >= list.length) {
      await send(from, `❌ اختيار غير صحيح، أرسل رقم من 1 إلى ${list.length}`);
      return;
    }
    session.product = list[idx];
    session.step = 'confirm';
    await send(from, `✅ اخترت: *${session.product.name}*
💰 السعر: *${session.product.price.toLocaleString()} جنيه*

هل تريد المتابعة؟
1️⃣ نعم، أكمل الطلب
2️⃣ رجوع للقائمة`);
    return;
  }

  if (session.step === 'confirm') {
    if (text === '1') {
      session.step = 'get_uid';
      await send(from, '🎮 أرسل لنا *ID حسابك* في اللعبة:');
    } else {
      session.step = 'main_menu';
      await send(from, '↩️ تم الرجوع، أرسل رقم الخدمة المطلوبة:\n\n1️⃣ ببجي\n2️⃣ فري فاير\n3️⃣ جوجل بلاي\n4️⃣ خدمات أخرى\n5️⃣ دعم');
    }
    return;
  }

  if (session.step === 'get_uid') {
    session.uid = text;
    session.step = 'get_name';
    await send(from, '👤 أرسل لنا *اسم حسابك* في اللعبة:');
    return;
  }

  if (session.step === 'get_name') {
    session.playerName = text;
    session.step = 'done';

    await send(from, `🎉 تم تسجيل طلبك بنجاح!

📦 *تفاصيل الطلب:*
🎮 المنتج: ${session.product.name}
💰 السعر: ${session.product.price.toLocaleString()} جنيه
🆔 ID: ${session.uid}
👤 الاسم: ${session.playerName}

${PAYMENT_INFO}

بعد التحويل أرسل كلمة *"تم الدفع"* وسيتم تنفيذ طلبك في أقرب وقت 🚀`);

    // إشعار للأدمن
    await send(ADMIN_PHONE, `🔔 *طلب جديد!*
📱 العميل: ${from}
🎮 المنتج: ${session.product.name}
💰 السعر: ${session.product.price.toLocaleString()} جنيه
🆔 ID: ${session.uid}
👤 الاسم: ${session.playerName}`);

    session.step = 'start';
    return;
  }

  if (text === 'تم الدفع') {
    await send(from, '✅ شكراً! تم استلام إشعار دفعك، سيتم تنفيذ طلبك قريباً 🚀\nللاستفسار تواصل معنا: wa.me/249901815039');
    return;
  }

  // أي رسالة ثانية
  await send(from, '👋 أهلاً! أرسل أي شيء للبدء أو اكتب "رجوع" للقائمة الرئيسية');
}

async function send(to, text) {
  await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, text: { body: text } }),
  });
}
