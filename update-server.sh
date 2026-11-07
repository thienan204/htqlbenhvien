#!/bin/bash

echo "==================================================="
echo "🚀 BẮT ĐẦU CẬP NHẬT MÃ NGUỒN VÀ DATABASE (HTQLBENHVIEN)"
echo "==================================================="

echo ""
echo "🛡️ Bước 0: Tự động sao lưu dữ liệu hiện tại để phòng ngừa rủi ro..."
if [ -f ./backup.sh ]; then
  bash ./backup.sh || echo "⚠️ Cảnh báo: Sao lưu tự động không thành công, tiếp tục quy trình..."
fi

echo ""
echo "📥 Bước 1: Kéo mã nguồn mới nhất từ GitHub..."
# Tự động sao lưu an toàn file .env
if [ -f .env ]; then
  cp .env .env.backup
fi

# Lưu lại commit hash hiện tại để khôi phục nếu build thất bại
PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

# Ép đồng bộ mã nguồn 100% giống với Github nhánh htqlbenhvien
git fetch origin htqlbenhvien
if ! git reset --hard origin/htqlbenhvien; then
  echo "❌ Lỗi: Không thể kéo mã nguồn từ GitHub! Giữ nguyên phiên bản hiện tại."
  if [ -f .env.backup ]; then
    mv .env.backup .env
  fi
  exit 1
fi

# Đắp lại file .env vào hệ thống sau khi reset
if [ -f .env.backup ]; then
  mv .env.backup .env
fi

echo ""
echo "🔧 Đảm bảo thư mục Upload tồn tại và cập nhật phiên bản..."
mkdir -p public/uploads
node scripts/generate-build-info.js 2>/dev/null || true

echo ""
echo "🏗️ Bước 2: Build Image mới ở chế độ nền (Hệ thống cũ VẪN HOẠT ĐỘNG BÌNH THƯỜNG)..."
# Chặn lỗi: Nếu Docker build thất bại (lỗi TypeScript/cú pháp), DỪNG NGAY để bảo vệ hệ thống cũ
if ! docker compose -f docker-compose.prod.yml build app-htql; then
  echo ""
  echo "❌=========================================================================="
  echo "❌ LỖI BUILD: Mã nguồn mới gặp lỗi biên dịch (TypeScript/Build Error)!"
  echo "🛡️ BẢO VỆ AN TOÀN: Đã hủy bỏ cập nhật. Container cũ VẪN ĐANG CHẠY BÌNH THƯỜNG."
  echo "💡 Hệ thống bệnh viện KHÔNG bị gián đoạn. Vui lòng sửa lỗi code trên máy dev."
  echo "=========================================================================="
  if [ -n "$PREV_COMMIT" ]; then
    echo "↩️ Đang khôi phục lại mã nguồn server về commit trước: $PREV_COMMIT"
    git reset --hard "$PREV_COMMIT"
    if [ -f .env.backup ]; then
      mv .env.backup .env
    fi
  fi
  exit 1
fi

echo ""
echo "🔄 Bước 2.1: Chuyển giao sang Container mới (Chỉ mất ~1-2 giây, không gián đoạn)..."
docker compose -f docker-compose.prod.yml up -d --no-deps app-htql

echo "⏳ Đang kiểm tra trạng thái khởi động của Container mới..."
sleep 5

# Kiểm tra container có đang running không
CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' htqlbenhvien-app 2>/dev/null || echo "not_found")
if [ "$CONTAINER_STATUS" != "running" ]; then
  echo ""
  echo "❌=========================================================================="
  echo "❌ CẢNH BÁO: Container mới gặp sự cố khi khởi động (Trạng thái: $CONTAINER_STATUS)!"
  echo "📋 30 dòng log gần nhất từ Container mới:"
  docker logs --tail 30 htqlbenhvien-app
  echo "=========================================================================="
  echo "💡 Vui lòng kiểm tra lại cấu hình hoặc biến môi trường."
  exit 1
fi
echo "✅ Container mới đã khởi động và đang hoạt động ổn định."

echo ""
echo "🗄️ Bước 3: Chạy cấu hình Database và Fix phân quyền..."
docker exec -u root htqlbenhvien-app chown -R 1001:1001 /app/public/uploads
if ! docker exec htqlbenhvien-app npx -y prisma@5.22.0 db push --skip-generate; then
  echo "⚠️ Cảnh báo: Lệnh db push gặp lỗi, vui lòng kiểm tra lại cấu hình Database."
fi

echo ""
echo "==================================================="
echo "✅ HOÀN TẤT! HỆ THỐNG ĐÃ ĐƯỢC CẬP NHẬT THÀNH CÔNG."
echo "Truy cập: http://192.168.3.98:3005/htqlbenhvien"
echo "==================================================="
