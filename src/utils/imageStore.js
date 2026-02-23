// imageStore.js — IndexedDB image storage (avoids localStorage bloat)
// Images are compressed on upload and stored as blobs in IndexedDB.

const DB_NAME = 'quiz_images';
const STORE_NAME = 'images';
const DB_VERSION = 1;
const MAX_WIDTH = 800;
const JPEG_QUALITY = 0.75;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Compress image file → returns { id, dataUrl }
export async function compressAndStore(file) {
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dataUrl = await compressImage(file);
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(dataUrl, id);
        tx.oncomplete = () => resolve({ id, dataUrl });
        tx.onerror = () => reject(tx.error);
    });
}

// Get image by ID → returns dataUrl or null
export async function getImage(id) {
    if (!id || id.startsWith('http') || id.startsWith('data:')) return id;
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
}

// Delete image by ID
export async function deleteImage(id) {
    if (!id || id.startsWith('http')) return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
    } catch { /* ignore */ }
}

// Compress: resize + JPEG quality reduction
function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > MAX_WIDTH) { h = (MAX_WIDTH / w) * h; w = MAX_WIDTH; }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}
