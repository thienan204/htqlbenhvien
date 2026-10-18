#!/bin/bash

# ==========================================================
# SCRIPT BACKUP TỰ ĐỘNG DỮ LIỆU HTQLBENHVIEN
# Tự động sao lưu PostgreSQL Database và thư mục Uploads
# ==========================================================

set -e

# Tự động lấy thư mục gốc của dự án
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Thư mục lưu trữ backup (mặc định trong ./backups hoặc biến môi trường BACKUP_DIR)
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
DATE=$(date +"%Y%m%d_%H%M%S")
TARGET_DIR="$BACKUP_DIR/$DATE"

echo "=================================================="
echo "🕒 [$(date +'%Y-%m-%d %H:%M:%S')] BẮT ĐẦU BACKUP HỆ THỐNG"
echo "=================================================="

# 1. Tạo thư mục đích
mkdir -p "$TARGET_DIR"

# 2. Đọc cấu hình từ file .env nếu có
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$PROJECT_DIR/.env" | xargs)
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-htqldb}"
DB_CONTAINER="htqlbenhvien-db"

# 3. Kiểm tra container Database có đang chạy không
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "❌ Lỗi: Container ${DB_CONTAINER} không chạy! Hủy tiến trình backup."
    exit 1
fi

# 4. Sao lưu cơ sở dữ liệu PostgreSQL
echo "📦 Đang sao lưu Database (${DB_NAME})..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$TARGET_DIR/db_${DB_NAME}.sql.gz"
echo "✅ Đã sao lưu DB thành công: $TARGET_DIR/db_${DB_NAME}.sql.gz"

# 5. Sao lưu thư mục Uploads và file .env
echo "📦 Đang sao lưu thư mục tệp tin uploads và .env..."
if [ -d "$PROJECT_DIR/public/uploads" ]; then
    tar -czf "$TARGET_DIR/uploads.tar.gz" -C "$PROJECT_DIR" public/uploads .env 2>/dev/null || true
    echo "✅ Đã sao lưu uploads thành công: $TARGET_DIR/uploads.tar.gz"
fi

# 6. Tự động dọn dẹp các bản backup cũ hơn 14 ngày
RETENTION_DAYS=14
echo "🧹 Đang dọn dẹp các bản backup cũ hơn $RETENTION_DAYS ngày..."
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} +

# 7. Thông báo hoàn tất
BACKUP_SIZE=$(du -sh "$TARGET_DIR" | cut -f1)
echo "=================================================="
echo "🎉 HOÀN TẤT BACKUP THÀNH CÔNG!"
echo "📁 Thư mục lưu trữ: $TARGET_DIR"
echo "📊 Dung lượng gói: $BACKUP_SIZE"
echo "=================================================="
