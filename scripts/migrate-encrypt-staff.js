/**
 * SCRIPT MÃ HÓA TOÀN BỘ THÔNG TIN NHÂN SỰ TRONG CSDL (ONE-TIME MIGRATION)
 * Cách chạy: node scripts/migrate-encrypt-staff.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Tự động nạp .env nếu chưa có
try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [k, ...v] = trimmed.split('=');
                const val = v.join('=').trim().replace(/^["']|["']$/g, '');
                if (!process.env[k.trim()]) {
                    process.env[k.trim()] = val;
                }
            }
        }
    }
} catch (e) {
    // Ignore
}

const prisma = new PrismaClient();
const ENCRYPTION_PREFIX = 'enc:v1:';

function getEncryptionKey() {
    const rawKey = process.env.STAFF_ENCRYPTION_KEY;
    if (rawKey && rawKey.length === 64) {
        return Buffer.from(rawKey, 'hex');
    }
    const fallbackSeed = process.env.JWT_SECRET || 'htqlbenhvien-staff-encryption-fallback-key-2026';
    return crypto.createHash('sha256').update(fallbackSeed).digest();
}

function getBlindSalt() {
    return process.env.STAFF_BLIND_SALT || process.env.JWT_SECRET || 'htqlbenhvien-staff-blind-index-salt-2026';
}

function encryptField(plainText) {
    if (!plainText) return plainText;
    const str = String(plainText).trim();
    if (!str || str.startsWith(ENCRYPTION_PREFIX)) return str;

    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(str, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (e) {
        console.error('Lỗi mã hóa:', e);
        return str;
    }
}

function decryptField(cipherText) {
    if (!cipherText) return cipherText;
    const str = String(cipherText).trim();
    if (!str.startsWith(ENCRYPTION_PREFIX)) return str;

    try {
        const parts = str.slice(ENCRYPTION_PREFIX.length).split(':');
        if (parts.length !== 3) return str;
        const [ivHex, tagHex, encryptedHex] = parts;
        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return str;
    }
}

function generateBlindIndex(text) {
    if (!text) return null;
    const cleanStr = String(text).trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanStr) return null;
    return crypto.createHmac('sha256', getBlindSalt()).update(cleanStr).digest('hex');
}

async function main() {
    console.log('====================================================');
    console.log('🛡️ BẮT ĐẦU MÃ HÓA THÔNG TIN NHÂN SỰ (STAFF ENCRYPTION)');
    console.log('====================================================');

    const allStaff = await prisma.staff.findMany({
        select: {
            id: true,
            ma_nv: true,
            ho_ten: true,
            cccd: true,
            so_dien_thoai: true,
            ma_bhxh: true,
            cccd_hash: true,
            so_dien_thoai_hash: true
        }
    });

    console.log(`📊 Tìm thấy tổng cộng: ${allStaff.length} cán bộ nhân viên.`);
    let encryptedCount = 0;

    for (const staff of allStaff) {
        const updateData = {};
        let needUpdate = false;

        // Mã hóa CCCD
        if (staff.cccd && !staff.cccd.startsWith(ENCRYPTION_PREFIX)) {
            updateData.cccd = encryptField(staff.cccd);
            needUpdate = true;
        }

        // Mã hóa Số điện thoại
        if (staff.so_dien_thoai && !staff.so_dien_thoai.startsWith(ENCRYPTION_PREFIX)) {
            updateData.so_dien_thoai = encryptField(staff.so_dien_thoai);
            needUpdate = true;
        }

        // Mã hóa Mã BHXH
        if (staff.ma_bhxh && !staff.ma_bhxh.startsWith(ENCRYPTION_PREFIX)) {
            updateData.ma_bhxh = encryptField(staff.ma_bhxh);
            needUpdate = true;
        }

        // Cập nhật hash tìm kiếm
        if (staff.cccd) {
            const plain = staff.cccd.startsWith(ENCRYPTION_PREFIX) ? decryptField(staff.cccd) : staff.cccd;
            const h = generateBlindIndex(plain);
            if (staff.cccd_hash !== h) {
                updateData.cccd_hash = h;
                needUpdate = true;
            }
        }

        if (staff.so_dien_thoai) {
            const plain = staff.so_dien_thoai.startsWith(ENCRYPTION_PREFIX) ? decryptField(staff.so_dien_thoai) : staff.so_dien_thoai;
            const h = generateBlindIndex(plain);
            if (staff.so_dien_thoai_hash !== h) {
                updateData.so_dien_thoai_hash = h;
                needUpdate = true;
            }
        }

        if (needUpdate) {
            await prisma.staff.update({
                where: { id: staff.id },
                data: updateData
            });
            encryptedCount++;
        }
    }

    console.log(`✅ HOÀN TẤT: Đã cập nhật và mã hóa an toàn ${encryptedCount}/${allStaff.length} nhân sự.`);
    console.log('====================================================');
}

main()
    .catch(err => {
        console.error('❌ Lỗi khi chạy migration mã hóa:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
