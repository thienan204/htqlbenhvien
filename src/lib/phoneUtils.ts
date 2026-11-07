/**
 * Tiện ích xử lý số điện thoại theo định dạng Việt Nam
 * Hỗ trợ nhận diện số cố định (02053.600.553, 024..., 028...) và số di động (09x, 08x, 07x, 03x, 05x)
 */

export function cleanPhoneNumber(phone?: string | null): string {
    if (!phone) return '';
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.startsWith('84') && cleaned.length >= 11) {
        cleaned = '0' + cleaned.slice(2);
    }
    return cleaned;
}

export function isValidPhoneNumber(phone?: string | null): boolean {
    const clean = cleanPhoneNumber(phone);
    if (!clean.startsWith('0')) return false;
    // Độ dài SĐT Việt Nam: 10 số (di động, cố định mới) hoặc 11 số (cố định tỉnh có mã vùng dài như 02053...)
    return clean.length === 10 || clean.length === 11;
}

export function extractPhoneNumbers(text?: string | null): string[] {
    if (!text) return [];
    // Quét các mẫu số điện thoại: 02053.600.553, 0912.345.678, 0205 360 0553, +842053600553, 02053600553
    const regex = /(?:(?:\+84|0)[1-9][0-9\s.-]{7,14}[0-9])/g;
    const matches = text.match(regex) || [];
    const results: string[] = [];
    const seenClean = new Set<string>();

    for (const raw of matches) {
        const clean = cleanPhoneNumber(raw);
        if (isValidPhoneNumber(clean) && !seenClean.has(clean)) {
            seenClean.add(clean);
            results.push(raw.trim());
        }
    }
    return results;
}

