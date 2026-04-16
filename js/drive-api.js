// ==================== GOOGLE DRIVE API v3 ====================
// Upload ảnh base64 lên Drive của user, trả về URL thumbnail
// Dùng scope: drive.file (chỉ file do app tạo, không đọc toàn bộ Drive)

const DriveAPI = {
    _rootFolderId: null,  // cache folder "ProductSnap Images"

    // Upload 1 ảnh base64 → trả về Drive thumbnail URL
    async uploadImage(base64DataUrl, filename, categoryName, productName) {
        const token = await OAuthClient.getToken();

        // Lấy/tạo folder cấu trúc: ProductSnap Images / Category / ProductName
        const rootId   = await this._getOrCreateRoot(token);
        const catId    = await this._getOrCreateFolder(token, categoryName || 'Uncategorized', rootId);
        const prodId   = await this._getOrCreateFolder(token, productName  || 'Product',       catId);

        // Convert base64 → Blob
        const [meta, b64] = base64DataUrl.split(',');
        const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mimeType });

        // Multipart upload
        const boundary = '-----ProductSnapBoundary';
        const metaBlob = new Blob(
            [`--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
             JSON.stringify({ name: filename, parents: [prodId] }),
             `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`],
            { type: 'text/plain' }
        );
        const endBlob  = new Blob([`\r\n--${boundary}--`], { type: 'text/plain' });
        const body = new Blob([metaBlob, blob, endBlob]);

        const uploadRes = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
            {
                method:  'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
                body
            }
        );
        if (!uploadRes.ok) throw new Error(`Drive upload failed: ${uploadRes.status}`);
        const file = await uploadRes.json();

        // Đặt quyền public (view)
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
            method:  'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ role: 'reader', type: 'anyone' })
        });

        // Thumbnail URL thân thiện với img src
        return `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;
    },

    // Lấy hoặc tạo folder con (parentId = null → root My Drive)
    async _getOrCreateFolder(token, name, parentId) {
        const safeQ = name.replace(/'/g, "\\'");
        const parentClause = parentId ? ` and '${parentId}' in parents` : '';
        const q = `name='${safeQ}' and mimeType='application/vnd.google-apps.folder'${parentClause} and trashed=false`;
        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.files?.length) return data.files[0].id;

        const meta = { name, mimeType: 'application/vnd.google-apps.folder' };
        if (parentId) meta.parents = [parentId];
        const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
            method:  'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify(meta)
        });
        const folder = await cr.json();
        return folder.id;
    },

    // Root folder "ProductSnap Images" (cached)
    async _getOrCreateRoot(token) {
        if (this._rootFolderId) return this._rootFolderId;
        const cached = localStorage.getItem('_ps_drive_root');
        if (cached) { this._rootFolderId = cached; return cached; }

        const id = await this._getOrCreateFolder(token, 'ProductSnap Images', null);
        // Tạo folder không parent ở My Drive
        this._rootFolderId = id;
        localStorage.setItem('_ps_drive_root', id);
        return id;
    }
};
