"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertFirebaseStorageUrl = assertFirebaseStorageUrl;
const ALLOWED_STORAGE_PREFIX = 'https://firebasestorage.googleapis.com/';
function assertFirebaseStorageUrl(url, label = 'photo_url') {
    if (!url || typeof url !== 'string') {
        throw new Error(`Invalid ${label}: URL is required`);
    }
    if (!url.startsWith(ALLOWED_STORAGE_PREFIX)) {
        throw new Error(`Invalid ${label}: only Firebase Storage URLs are allowed`);
    }
}
//# sourceMappingURL=storageUrl.js.map