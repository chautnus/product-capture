let capturedImages = [];
let cameraStream = null;
let facingMode = 'environment';

// ==================== CAMERA ====================
async function startCamera() {
    try {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: facingMode,
                width: { ideal: 4096, min: 1920 },
                height: { ideal: 2160, min: 1080 },
                aspectRatio: { ideal: 4/3 }
            },
            audio: false
        });

        const preview = document.getElementById('camera-preview');
        preview.srcObject = cameraStream;
        document.getElementById('camera-placeholder').style.display = 'none';
        document.getElementById('stop-camera').style.display = 'flex';
        document.querySelector('.camera-container')?.classList.add('camera-active');
    } catch (err) {
        console.error('Camera error:', err);
        alert('Could not access camera. Please check permissions.');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const preview = document.getElementById('camera-preview');
    preview.srcObject = null;
    document.getElementById('camera-placeholder').style.display = 'flex';
    document.getElementById('stop-camera').style.display = 'none';
    document.querySelector('.camera-container')?.classList.remove('camera-active');
}

function captureImage() {
    if (!cameraStream) {
        alert(currentLang === 'vi' ? 'Vui lòng bật camera trước' : 'Please start camera first');
        return;
    }

    const preview = document.getElementById('camera-preview');
    const canvas = document.getElementById('capture-canvas');

    canvas.width = preview.videoWidth;
    canvas.height = preview.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(preview, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    capturedImages.push(imageData);
    renderCapturedImages();
}

function switchCamera() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
}

function renderCapturedImages() {
    const container = document.getElementById('captured-images');
    container.innerHTML = capturedImages.map((img, idx) => `
        <div class="captured-img">
            <img src="${img}" alt="Captured ${idx + 1}" referrerpolicy="no-referrer">
            <button class="remove-btn" onclick="removeImage(${idx})">×</button>
        </div>
    `).join('');
}

function removeImage(idx) {
    capturedImages.splice(idx, 1);
    renderCapturedImages();
}

// ==================== WEB IMPORT (Bookmarklet) ====================

// Fetch ảnh từ URL về base64 (CORS-first + 3s timeout, fallback lưu URL string trực tiếp)
async function fetchImageAsBase64(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000); // fail fast nếu CORS/server chậm
        const resp = await fetch(url, { mode: 'cors', signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) throw new Error('fetch failed');
        const blob = await resp.blob();
        return new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = e => res(e.target.result);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
        });
    } catch {
        return url; // CORS fail / timeout → lưu URL string
    }
}

async function handleWebImport(urls) {
    switchScreen('capture');
    showToast(currentLang === 'vi' ? `Đang tải ${urls.length} ảnh...` : `Loading ${urls.length} image(s)...`);

    // Promise.all: fetch song song thay vì tuần tự — tổng thời gian = max(từng ảnh) thay vì sum
    const results = await Promise.all(urls.map(url => fetchImageAsBase64(url)));
    results.forEach(imgData => {
        if (!capturedImages.includes(imgData)) capturedImages.push(imgData);
    });
    renderCapturedImages();

    // Auto-chọn danh mục cuối cùng đã dùng (hoặc danh mục đầu tiên)
    const lastCat = localStorage.getItem('lastCategory') || appData.categories[0]?.id;
    if (lastCat) {
        selectedCategory = lastCat;
        document.querySelectorAll('.category-card').forEach(card => {
            card.classList.toggle('active', card.dataset.categoryId === lastCat);
        });
        if (typeof renderDynamicForm === 'function') renderDynamicForm();
    }

    // Scroll xuống form
    setTimeout(() => document.getElementById('dynamic-form')?.scrollIntoView({ behavior: 'smooth' }), 300);
    showToast(currentLang === 'vi' ? `Đã tải ${capturedImages.length} ảnh` : `Loaded ${capturedImages.length} image(s)`);

    // Xoá ?import= khỏi URL bar
    window.history.replaceState({}, '', location.pathname);
}
