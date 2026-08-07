#!/bin/bash

echo "==================================================="
echo "🚀 BẮT ĐẦU CẬP NHẬT MÃ NGUỒN VÀ DATABASE (HTQLBENHVIEN)"
echo "==================================================="

echo ""
echo "📥 Bước 1: Kéo mã nguồn mới nhất từ GitHub..."
# Tự động sao lưu an toàn file .env
if [ -f .env ]; then
  cp .env .env.backup
fi

# Ép đồng bộ mã nguồn 100% giống với Github nhánh htqlbenhvien
git fetch origin htqlbenhvien
git reset --hard origin/htqlbenhvien

# Đắp lại file .env vào hệ thống sau khi reset
if [ -f .env.backup ]; then
  mv .env.backup .env
fi

echo ""
echo "🔧 Fix quyền thư mục Upload..."
mkdir -p public/uploads
chmod -R 777 public/uploads

echo ""
echo "🏗️ Bước 2: Build lại hệ thống với Code mới..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "🗄️ Bước 3: Chạy cấu hình Database (Đẩy cấu trúc bảng mới vào DB)..."
docker exec htqlbenhvien-app npx -y prisma@5.22.0 db push --skip-generate

echo ""
echo "==================================================="
echo "✅ HOÀN TẤT! HỆ THỐNG ĐÃ ĐƯỢC CẬP NHẬT THÀNH CÔNG."
echo "Truy cập: http://192.168.3.98/htqlbenhvien"
echo "==================================================="
