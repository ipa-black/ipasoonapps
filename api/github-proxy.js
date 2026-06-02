import { Buffer } from 'buffer';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '100mb', // يدعم رفع الملفات الكبيرة
        },
    },
};

export default async function handler(req, res) {
    // إعدادات الـ CORS لتتوافق مع ملف vercel.json الخاص بك
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // جلب التوكن القادم ديناميكياً من متصفحك (من الـ LocalStorage) لحمايته من الحظر
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "لم يتم إرسال التوكن من المتصفح" });
    }

    const { path, upload, raw, release } = req.query;
    if (!path) {
        return res.status(400).json({ error: "المسار path مطلوب" });
    }

    // الإعدادات الافتراضية لحسابك ومستودعك (تُقرأ تلقائياً من روابط الواجهة)
    // الروابط ستكون بصيغة: owner/repo/releases... إلخ
    const headers = {
        'Authorization': authHeader,
        'User-Agent': 'Vercel-GitHub-Proxy'
    };

    try {
        let targetUrl = '';

        // 1. إذا كان طلب رفع ملف IPA (github-upload)
        if (upload === '1') {
            targetUrl = `https://uploads.github.com/repos/${path}`;
            
            const response = await fetch(targetUrl, {
                method: req.method,
                headers: { 
                    ...headers, 
                    'Content-Type': req.headers['content-type'] || 'application/octet-stream' 
                },
                body: req.body
            });
            const data = await response.json();
            return res.status(response.status).json(data);
        }

        // 2. إذا كان طلب جلب ملف خام (github-raw)
        if (raw === '1') {
            targetUrl = `https://raw.githubusercontent.com/${path}`;
            const response = await fetch(targetUrl, { headers });
            const data = await response.text();
            return res.status(response.status).send(data);
        }

        // 3. طلبات الـ API العادية (الريليس، جلب القائمة، الحذف)
        targetUrl = `https://api.github.com/repos/${path}`;

        const fetchOptions = {
            method: req.method,
            headers: { ...headers, 'Content-Type': 'application/json' }
        };

        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
            fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        }

        const response = await fetch(targetUrl, fetchOptions);
        
        if (response.status === 204) {
            return res.status(204).end();
        }

        const data = await response.json();
        return res.status(response.status).json(data);

    } catch (error) {
        return res.status(500).json({ error: "خطأ في البروكسي", details: error.message });
    }
}
