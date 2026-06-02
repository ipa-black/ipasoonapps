export const config = {
    api: {
        bodyParser: false, // إيقاف الفحص المسبق للحجم في فيرسل لمنع التجمد والخطأ
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

    const { path, upload, raw } = req.query;
    if (!path) {
        return res.status(400).json({ error: "المسار path مطلوب" });
    }

    // تجهيز الهيدرز الأساسية
    const headers = {
        'Authorization': authHeader,
        'User-Agent': 'Vercel-GitHub-Proxy',
    };

    if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'];
    }

    try {
        let targetUrl = '';

        if (upload === '1') {
            targetUrl = `https://uploads.github.com/repos/${path}`;
        } else if (raw === '1') {
            targetUrl = `https://raw.githubusercontent.com/${path}`;
        } else {
            targetUrl = `https://api.github.com/repos/${path}`;
        }

        // تمرير البيانات كتدفق (Stream) مباشرة لـ GitHub لمنع قيود الحجم وفشل الرفع
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
            duplex: 'half' // تفعيل خاصية التمرير الثنائي للملفات الكبيرة
        });

        if (response.status === 204) {
            return res.status(204).end();
        }

        // إذا كان الملف خام (صورة أو IPA)
        if (raw === '1' || req.method === 'HEAD') {
            const data = await response.text();
            return res.status(response.status).send(data);
        }

        const data = await response.json();
        return res.status(response.status).json(data);

    } catch (error) {
        return res.status(500).json({ error: "خطأ في البروكسي", details: error.message });
    }
}
