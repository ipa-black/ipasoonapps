export const config = {
    api: {
        bodyParser: false, // إيقاف الفحص المسبق للحجم في فيرسل لتمكين الستريمينج ومنع التجمد
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "لم يتم إرسال التوكن" });
    }

    // قراءة الرابط الأصلي لتمرير الـ Query Parameters بشكل صحيح (مثل اسم الملف)
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const path = urlObj.searchParams.get('path');
    const upload = urlObj.searchParams.get('upload');

    if (!path) {
        return res.status(400).json({ error: "المسار path مطلوب" });
    }

    const headers = {
        'Authorization': authHeader,
        'User-Agent': 'Vercel-GitHub-Proxy',
    };

    if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'];
    }

    try {
        // تنظيف الكويري وإزالة معاملات البروكسي الخاصة بفيرسل قبل إرسالها لجيت هب
        const cleanParams = new URLSearchParams(urlObj.searchParams);
        cleanParams.delete('path');
        cleanParams.delete('upload');
        const queryString = cleanParams.toString() ? `?${cleanParams.toString()}` : '';

        let targetUrl = '';
        if (upload === '1') {
            targetUrl = `https://uploads.github.com/repos/${path}${queryString}`;
        } else {
            targetUrl = `https://api.github.com/repos/${path}${queryString}`;
        }

        // تمرير البيانات كتدفق (Stream) مباشر إلى جيت هب دون تخزين مؤقت في فيرسل
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
            duplex: 'half'
        });

        if (response.status === 204) {
            return res.status(204).end();
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            return res.status(response.status).json(data);
        } else {
            const data = await response.text();
            return res.status(response.status).send(data);
        }

    } catch (error) {
        return res.status(500).json({ error: "خطأ في البروكسي الداخلي", details: error.message });
    }
}
