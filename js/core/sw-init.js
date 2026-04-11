// ==================== SERVICE WORKER ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('SW registered:', registration.scope);

            // When a new SW is found, tell it to activate immediately
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[SW] New version installed, activating...');
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });

            // Reload AFTER new SW takes control (safe, non-blocking)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[SW] Controller changed, reloading...');
                window.location.reload();
            });
        } catch (error) {
            console.log('SW registration failed:', error);
        }
    });

    // Listen for messages from Service Worker (shared images)
    navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from SW:', event.data);
        if (event.data.type === 'SHARE_TARGET') {
            handleSharedImages(event.data);
        }
    });
}

// Check for shared images on page load
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('shared') === 'true') {
        console.log('App opened via share');
        requestSharedDataFromSW();
        // Bug A fix: use relative path
        window.history.replaceState({}, '', './index.html');
    }
});

// Request shared data from Service Worker
function requestSharedDataFromSW() {
    if (!navigator.serviceWorker.controller) {
        console.log('No SW controller, waiting...');
        navigator.serviceWorker.ready.then(() => {
            setTimeout(requestSharedDataFromSW, 500);
        });
        return;
    }

    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'SHARED_DATA' && event.data.data) {
            handleSharedImages(event.data.data);
        }
    };

    navigator.serviceWorker.controller.postMessage(
        { type: 'GET_SHARED_DATA' },
        [messageChannel.port2]
    );
}

// Handle images shared from other apps (Share Target API)
function handleSharedImages(data) {
    console.log('Handling shared images:', data);

    if (data.images && data.images.length > 0) {
        data.images.forEach(img => {
            if (img && !capturedImages.includes(img)) {
                capturedImages.push(img);
            }
        });

        renderCapturedImages();

        const count = data.images.length;
        const msg = currentLang === 'vi'
            ? `Đã nhận ${count} ảnh từ chia sẻ`
            : `Received ${count} image(s) from share`;
        showToast(msg);

        switchScreen('capture');

        if (data.title && data.title.trim()) {
            setTimeout(() => {
                const nameInput = document.getElementById('product-name-input');
                if (nameInput) {
                    nameInput.value = data.title.trim();
                }
            }, 500);
        }
    }
}
