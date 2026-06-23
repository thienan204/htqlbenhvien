# Quản trị Server & Nginx Proxy

Dành cho Quản trị viên hệ thống (Admin/IT). Tài liệu này ghi lại kiến trúc triển khai thực tế của ứng dụng trên máy chủ.

## 1. Kiến trúc Tách biệt (Decoupling)
Hệ thống hiện tại bao gồm 2 dự án chạy song song và độc lập:
1. **Dự án CheckBHYT:** Chạy trên Port `3000`.
2. **Dự án HTQLBENHVIEN:** Chạy trên Port `3001` (Kèm DB PostgreSQL độc lập trên port `5433`).

Sự tách biệt này giúp giải quyết tình trạng xung đột thư viện, tràn bộ nhớ (RAM) và đảm bảo an toàn dữ liệu. Việc ứng dụng này sập sẽ không làm ảnh hưởng đến ứng dụng kia.

## 2. Nginx Proxy (Bộ định tuyến)
Nginx được sử dụng như một Reverse Proxy đứng trước để hứng các truy cập từ ngoài vào (port 80/443) và điều hướng (route) vào đúng port nội bộ (3000 hoặc 3001).

> [!IMPORTANT]
> Cấu hình Nginx hiện được lưu trữ tại thư mục `~/nginx-proxy/` trên Server. Tuyệt đối **không** sửa file Nginx bên trong thư mục source code của dự án, vì thư mục đó chỉ mang tính chất backup/tham khảo.

### Hỗ trợ WebSocket (Hot-Reload)
Để tính năng tự động tải lại trang (Hot Reload) của Next.js hoạt động mượt mà qua Nginx, chúng ta đã cấu hình Nginx bắt các request `/t-u-r-b-o-p-a-c-k-m-e-s-s-a-g-e` và `/hmr` để Upgrade lên chuẩn WebSocket:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## 3. Hướng dẫn Restart Nginx
Nếu bạn thay đổi cấu hình trong thư mục `~/nginx-proxy/`, bạn cần restart lại container Nginx bằng lệnh:
```bash
cd ~/nginx-proxy/
docker-compose restart
```
Hoặc để xem log lỗi nếu Nginx không khởi động được:
```bash
docker-compose logs -f
```
