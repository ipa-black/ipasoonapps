import { Buffer } from 'buffer';
import configData from '../config.json'; 

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '100mb', // يدعم أحجام ملفات الـ IPA الكبيرة
        },
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const GITHUB_TOKEN = configData.GITHUB_TOKEN; 
    const REPO_OWNER = configData.REPO_OWNER;
    const REPO_NAME = configData.REPO_NAME;
    const RELEASE_TAG = configData.RELEASE_TAG;

    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: "لم يتم العثور على التوكن في ملف config.json" });
    }

    const headers = { 'Authorization': `token ${GITHUB_TOKEN}` };

    try {
        // 1. جلب قائمة التطبيقات (GET)
        if (req.method === 'GET') {
            const result = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${RELEASE_TAG}`, { headers });
            if (!result.ok) return res.status(404).json({ error: "لا يوجد ريليس حالي" });
            const data = await result.json();
            return res.status(200).json(data.assets || []);
        }

        // 2. رفع الملفات (POST)
        if (req.method === 'POST') {
            const { action, fileName, fileData, iconName, iconData } = req.body;

            // رفع الأيقونة المستخرجة تلقائياً إلى مجلد icons/
            if (action === 'upload_icon' && iconName && iconData) {
                const imgRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/icons/${iconName}`, {
                    method: 'PUT',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: `Upload icon ${iconName}`, content: iconData })
                });
                return res.status(imgRes.status).json({ success: imgRes.ok });
            }

            // رفع ملف الـ IPA إلى الـ Release
            if (action === 'upload_ipa' && fileName && fileData) {
                let releaseId;
                const relCheck = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${RELEASE_TAG}/releases/tags/${RELEASE_TAG}`, { headers }).catch(() => ({ok: false}));
                
                // التحقق من وجود الريليس أو إنشائه تلقائياً
                const checkRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${RELEASE_TAG}`, { headers });
                if (checkRes.ok) {
                    const relData = await checkRes.json();
                    releaseId = relData.id;
                } else {
                    const createRel = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`, {
                        method: 'POST',
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tag_name: RELEASE_TAG, name: RELEASE_TAG, body: "IPA Storage" })
                    });
                    const newRelData = await createRel.json();
                    releaseId = newRelData.id;
                }

                const bufferData = Buffer.from(fileData, 'base64');
                const uploadUrl = `https://uploads.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;
                
                const ipaRes = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
                    body: bufferData
                });

                return res.status(ipaRes.status).json({ success: ipaRes.ok });
            }
        }

        // 3. حذف الملفات والأيقونات (DELETE)
        if (req.method === 'DELETE') {
            const { assetId, iconPath } = req.query;
            if (assetId) await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${assetId}`, { method: 'DELETE', headers });
            
            if (iconPath) {
                const fileCheck = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${iconPath}`, { headers });
                if (fileCheck.ok) {
                    const fileData = await fileCheck.json();
                    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${iconPath}`, {
                        method: 'DELETE',
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: `Delete icon`, sha: fileData.sha })
                    });
                }
            }
            return res.status(200).json({ success: true });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
