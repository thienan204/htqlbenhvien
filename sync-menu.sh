#!/bin/bash

echo "==================================================="
echo "🚀 ĐỒNG BỘ CẤU TRÚC MENU LÊN DATABASE (CHỈ BẢNG MENU)"
echo "==================================================="

echo ""
echo "📥 Bước 1: Kéo tệp Menu và Script mới nhất từ Git..."
git fetch origin htqlbenhvien
git checkout origin/htqlbenhvien -- prisma/seeds/menus.json scripts/sync-menu-only.js sync-menu.sh

echo ""
echo "🗄️ Bước 2: Nạp dữ liệu Menu vào Database trong Docker..."
docker exec htqlbenhvien-app node scripts/sync-menu-only.js

echo ""
echo "==================================================="
echo "🎉 HOÀN TẤT ĐỒNG BỘ MENU! Hãy tải lại (F5) trình duyệt để xem menu mới."
echo "==================================================="
