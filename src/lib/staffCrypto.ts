import crypto from 'crypto';

// Format chuỗi mã hóa: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
const ENCRYPTION_PREFIX = 'enc:v1:';

// Lấy Secret Key (32 bytes = 256 bits)
function getEncryptionKey(): Buffer {
    const rawKey = process.env.STAFF_ENCRYPTION_KEY;
    if (rawKey && rawKey.length === 64) {
        return Buffer.from(rawKey, 'hex');
    }
    // Fallback an toàn nếu chưa cấu hình biến môi trường: dùng SHA-256 từ chuỗi dự phòng
    const fallbackSeed = process.env.JWT_SECRET || 'htqlbenhvien-staff-encryption-fallback-key-2026';
    return crypto.createHash('sha256').update(fallbackSeed).digest();
}

// Lấy Blind Index Salt (dùng cho HMAC-SHA256)
function getBlindSalt(): string {
    return process.env.STAFF_BLIND_SALT || process.env.JWT_SECRET || 'htqlbenhvien-staff-blind-index-salt-2026';
}

/**
 * Mã hóa một trường văn bản đơn lẻ bằng AES-256-GCM
 */
export function encryptField(plainText: string | null | undefined): string | null {
    if (plainText === null || plainText === undefined) return null;
    const str = String(plainText).trim();
    if (!str) return '';

    // Nếu đã mã hóa rồi thì không mã hóa lặp lại (Idempotent)
    if (str.startsWith(ENCRYPTION_PREFIX)) {
        return str;
    }

    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(12); // 96-bit IV chuẩn cho GCM
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(str, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        console.error('Lỗi khi mã hóa dữ liệu (encryptField):', error);
        return str; // Fallback an toàn: giữ nguyên nếu có lỗi bất ngờ
    }
}

/**
 * Giải mã an toàn một trường văn bản (Dual-Read: tương thích dữ liệu cũ)
 */
export function decryptField(cipherText: string | null | undefined): string | null {
    if (cipherText === null || cipherText === undefined) return null;
    const str = String(cipherText).trim();
    if (!str) return '';

    // Dữ liệu cũ chưa mã hóa -> Trả về nguyên bản
    if (!str.startsWith(ENCRYPTION_PREFIX)) {
        return str;
    }

    try {
        const parts = str.slice(ENCRYPTION_PREFIX.length).split(':');
        if (parts.length !== 3) {
            return str;
        }

        const [ivHex, tagHex, encryptedHex] = parts;
        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(tagHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.warn('Lỗi khi giải mã dữ liệu (decryptField) - giữ nguyên chuỗi gốc:', error);
        return str; // Fallback an toàn: không bao giờ làm sập ứng dụng
    }
}

/**
 * Tạo mã băm mù (Blind Index) bằng HMAC-SHA256
 * Dùng để tìm kiếm chính xác và đăng nhập (ví dụ: cccd_hash, sdt_hash)
 */
export function generateBlindIndex(text: string | null | undefined): string | null {
    if (!text) return null;
    const cleanStr = String(text).trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanStr) return null;

    try {
        const salt = getBlindSalt();
        return crypto.createHmac('sha256', salt).update(cleanStr).digest('hex');
    } catch (error) {
        console.error('Lỗi sinh Blind Index:', error);
        return null;
    }
}

/**
 * Kiểm tra xem một chuỗi có đang ở dạng mã hóa hay không
 */
export function isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    return String(value).startsWith(ENCRYPTION_PREFIX);
}

/**
 * Che mặt nạ dữ liệu nhạy cảm hiển thị (Data Masking)
 */
export function maskSensitiveData(
    val: string | null | undefined, 
    type: 'CCCD' | 'PHONE' | 'BHXH' | 'TEXT' = 'TEXT'
): string {
    if (!val) return '-';
    // Đảm bảo giải mã trước khi che mặt nạ
    const plain = isEncrypted(val) ? (decryptField(val) || '') : String(val);
    const clean = plain.trim();
    if (!clean) return '-';

    switch (type) {
        case 'CCCD':
            // 020089001234 -> 020089****** (giữ 6 số đầu để nhận diện tỉnh/năm sinh, ẩn 6 số sau)
            if (clean.length >= 9) {
                return clean.slice(0, 6) + '******';
            }
            return clean.slice(0, 3) + '***';

        case 'PHONE':
            // 0912702369 -> 0912***369 (giữ 4 số đầu, 3 số cuối, ẩn 3 số giữa)
            if (clean.length >= 9) {
                return clean.slice(0, 4) + '***' + clean.slice(-3);
            }
            return clean.slice(0, 3) + '***';

        case 'BHXH':
            // 2021001234 -> 2021***234
            if (clean.length >= 7) {
                return clean.slice(0, 4) + '***' + clean.slice(-3);
            }
            return clean.slice(0, 2) + '***';

        case 'TEXT':
        default:
            if (clean.length <= 4) return '***';
            return clean.slice(0, 3) + '***' + clean.slice(-2);
    }
}

// Danh sách các trường nhạy cảm tiềm năng có thể mã hóa trong model Staff
export const SENSITIVE_STAFF_FIELDS = [
    'cccd',
    'so_dien_thoai',
    'ma_bhxh',
    'dia_chi',
    'ma_ho_gia_dinh',
    'noi_sinh_thon',
    'que_quan_thon',
    'noi_o_thon'
] as const;

export type SensitiveStaffField = typeof SENSITIVE_STAFF_FIELDS[number];

// 3 trường cốt lõi mặc định luôn được khuyến nghị bảo vệ
export const DEFAULT_ENCRYPTED_FIELDS: SensitiveStaffField[] = ['cccd', 'so_dien_thoai', 'ma_bhxh'];

/**
 * Tự động giải mã một đối tượng Staff
 */
export function decryptStaff<T extends Record<string, any>>(staff: T | null | undefined): T | null | undefined {
    if (!staff) return staff;
    const cloned: Record<string, any> = { ...staff };

    for (const field of SENSITIVE_STAFF_FIELDS) {
        if (typeof cloned[field] === 'string' && isEncrypted(cloned[field])) {
            cloned[field] = decryptField(cloned[field]);
        }
    }

    return cloned as T;
}

/**
 * Tự động giải mã một mảng danh sách Staff
 */
export function decryptStaffList<T extends Record<string, any>>(list: T[]): T[] {
    if (!Array.isArray(list)) return [];
    return list.map(item => decryptStaff(item) as T);
}

/**
 * Chuẩn bị dữ liệu Staff trước khi lưu vào CSDL (Mã hóa các trường được cấu hình và sinh Blind Hash)
 */
export function prepareStaffForSave<T extends Record<string, any>>(
    data: T, 
    activeFields: string[] = DEFAULT_ENCRYPTED_FIELDS
): T {
    if (!data) return data;
    const result: Record<string, any> = { ...data };

    for (const field of activeFields) {
        if (field in result && result[field] !== undefined && result[field] !== null) {
            const rawVal = String(result[field]).trim();
            if (rawVal) {
                // Đảm bảo không mã hóa đè chuỗi đã mã hóa
                const plainVal = isEncrypted(rawVal) ? (decryptField(rawVal) || rawVal) : rawVal;
                result[field] = encryptField(plainVal);
            }
        }
    }

    // Tự động đồng bộ cccd_hash phục vụ đăng nhập & tìm kiếm
    if ('cccd' in result && result.cccd !== undefined) {
        if (result.cccd) {
            const plainCccd = isEncrypted(result.cccd) ? decryptField(result.cccd) : String(result.cccd);
            result.cccd_hash = generateBlindIndex(plainCccd);
        } else {
            result.cccd_hash = null;
        }
    }

    // Tự động đồng bộ so_dien_thoai_hash
    if ('so_dien_thoai' in result && result.so_dien_thoai !== undefined) {
        if (result.so_dien_thoai) {
            const plainPhone = isEncrypted(result.so_dien_thoai) ? decryptField(result.so_dien_thoai) : String(result.so_dien_thoai);
            result.so_dien_thoai_hash = generateBlindIndex(plainPhone);
        } else {
            result.so_dien_thoai_hash = null;
        }
    }

    return result as T;
}

