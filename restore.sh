#!/bin/bash

# ==========================================================
# SCRIPT PHỤC HỒI DỮ LIỆU TỰ ĐỘNG (DISASTER RECOVERY)
# Khôi phục PostgreSQL Database và thư mục Uploads từ bản sao lưu
# ==========================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"

echo "=================================================="
echo "🚨 BẮT ĐẦU QUY TRÌNH PHỤC HỒI DỮ LIỆU (RESTORE)"
echo "=================================================="

# 1. Xác định thư mục backup cần phục hồi
TARGET_BACKUP="$1"

if [ -z "$TARGET_BACKUP" ]; then
    echo "🔍 Không chỉ định thư mục backup. Đang tìm các bản sao lưu gần nhất trong: $BACKUP_DIR"
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "❌ Lỗi: Thư mục $BACKUP_DIR trống hoặc không tồn tại!"
        echo "💡 Cách dùng: ./restore.sh <đường_dẫn_thư_mục_backup>"
        echo "Ví dụ: ./restore.sh backups/20261027_010000"
        exit 1
    fi

    echo ""
    echo "📋 Danh sách 5 bản sao lưu gần nhất:"
    BACKUP_LIST=($(ls -td "$BACKUP_DIR"/*/ 2>/dev/null | head -n 5))
    for i in "${!BACKUP_LIST[@]}"; do
        echo "  [$((i+1))] ${BACKUP_LIST[$i]}"
    done

    echo ""
    read -p "👉 Nhập số thứ tự bản sao lưu muốn phục hồi [1-${#BACKUP_LIST[@]}] (hoặc nhấn 'q' để hủy): " CHOICE
    if [[ "$CHOICE" == "q" || "$CHOICE" == "Q" ]]; then
        echo "Đã hủy thao tác phục hồi."
        exit 0
    fi

    if [[ "$CHOICE" =~ ^[1-9]$ ]] && [ "$CHOICE" -le "${#BACKUP_LIST[@]}" ]; then
        TARGET_BACKUP="${BACKUP_LIST[$((CHOICE-1))]}"
    else
        echo "❌ Lựa chọn không hợp lệ. Hủy tiến trình."
        exit 1
    fi
fi

# Chuẩn hóa đường dẫn
TARGET_BACKUP="${TARGET_BACKUP%/}"
if [ ! -d "$TARGET_BACKUP" ]; then
    echo "❌ Lỗi: Không tìm thấy thư mục backup tại: $TARGET_BACKUP"
    exit 1
fi

echo ""
echo "📁 Bản sao lưu được chọn: $TARGET_BACKUP"

# 2. Đọc cấu hình từ .env
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$PROJECT_DIR/.env" | xargs)
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-htqldb}"
DB_CONTAINER="htqlbenhvien-db"

# 3. Kiểm tra file cơ sở dữ liệu
DB_SQL_GZ=$(find "$TARGET_BACKUP" -maxdepth 1 -name "db_*.sql.gz" | head -n 1)
UPLOADS_TAR_GZ="$TARGET_BACKUP/uploads.tar.gz"

if [ -z "$DB_SQL_GZ" ] || [ ! -f "$DB_SQL_GZ" ]; then
    echo "❌ Lỗi: Không tìm thấy file sao lưu database (*.sql.gz) trong $TARGET_BACKUP"
    exit 1
fi

echo "📦 Tệp database: $(basename "$DB_SQL_GZ")"
if [ -f "$UPLOADS_TAR_GZ" ]; then
    echo "📦 Tệp uploads: $(basename "$UPLOADS_TAR_GZ")"
fi

# 4. Cảnh báo xác nhận lần cuối
echo ""
echo "⚠️ ======================== CẢNH BÁO QUAN TRỌNG ========================"
echo "  Hành động này sẽ XÓA TOÀN BỘ dữ liệu hiện tại trong Database '${DB_NAME}'"
echo "  và thay thế hoàn toàn bằng dữ liệu từ bản sao lưu này!"
echo "=========================================================================="
read -p "Bạn có chắc chắn 100% muốn phục hồi dữ liệu? (Gõ 'yes' để xác nhận): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Đã hủy phục hồi. Dữ liệu hiện tại không thay đổi."
    exit 0
fi

# 5. Kiểm tra container Database
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "🚀 Container ${DB_CONTAINER} đang tắt. Đang khởi động..."
    docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" up -d db-htql
    sleep 3
fi

# 6. Tiến hành khôi phục Database PostgreSQL
echo ""
echo "⏳ Đang đặt lại schema và nạp dữ liệu vào Database '${DB_NAME}'..."

# Ngắt các kết nối đang mở và reset schema public
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL ON SCHEMA public TO public;
" > /dev/null 2>&1 || true

# Nạp dữ liệu từ file sql.gz
gunzip -c "$DB_SQL_GZ" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" > /dev/null

echo "✅ Phục hồi Database thành công!"

# 7. Khôi phục thư mục Uploads
if [ -f "$UPLOADS_TAR_GZ" ]; then
    echo ""
    echo "⏳ Đang phục hồi tệp tin uploads..."
    tar -xzf "$UPLOADS_TAR_GZ" -C "$PROJECT_DIR"
    if docker ps --format '{{.Names}}' | grep -q "^htqlbenhvien-app$"; then
        docker exec -u root htqlbenhvien-app chown -R 1001:1001 /app/public/uploads 2>/dev/null || true
    fi
    echo "✅ Phục hồi tệp uploads thành công!"
fi

# 8. Khởi động lại ứng dụng để đồng bộ cache & connection pool
echo ""
echo "🔄 Đang khởi động lại ứng dụng để đồng bộ..."
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" restart app-htql > /dev/null 2>&1 || true

echo ""
echo "=================================================="
echo "🎉 CHÚC MỪNG! HỆ THỐNG ĐÃ ĐƯỢC PHỤC HỒI HOÀN TOÀN."
echo "Truy cập kiểm tra: http://192.168.3.98/htqlbenhvien"
echo "=================================================="
