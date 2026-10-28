# Hướng Dẫn Đồng Bộ Cấu Trúc Menu Lên Server (Chỉ Bảng Menu)

## 1. Giới thiệu
Tài liệu này hướng dẫn cách đồng bộ nhanh cấu trúc Menu chuẩn hóa từ máy Local (được định nghĩa trong `prisma/seeds/menus.json`) lên cơ sở dữ liệu trên máy chủ (Server).

> [!IMPORTANT]
> Script này **chỉ tác động duy nhất lên bảng `Menu`**. Tuyệt đối không làm thay đổi hay ảnh hưởng đến bất kỳ dữ liệu nào khác như: Người dùng, Nhân sự, Ticket yêu cầu, Quy tắc BHYT, Danh mục...

---

## 2. Các bước thực hiện trên máy chủ (Server)

### Cách 1: Chạy script 1-click `sync-menu.sh` (Khuyên dùng)
Trên terminal SSH của máy chủ, di chuyển vào thư mục dự án và chạy:

```bash
bash ./sync-menu.sh
```

**Quá trình thực hiện tự động chỉ mất 2 - 3 giây:**
1. Kéo tệp `prisma/seeds/menus.json` và script đồng bộ mới nhất từ Git về.
2. Tự động sao lưu menu cũ trên server vào thư mục `prisma/seeds/backups/`.
3. Nạp chính xác 63 menu (12 menu cha và 51 menu con) vào database Postgres trong Docker.
4. Hoàn tất ngay lập tức mà **không cần restart hay rebuild container Docker**.

---

### Cách 2: Chạy trực tiếp qua lệnh Docker
Nếu máy chủ đã kéo code mới về, bạn có thể thực hiện nạp trực tiếp qua lệnh:

```bash
docker exec htqlbenhvien-app node scripts/sync-menu-only.js
```

---

## 3. Kiểm tra kết quả
Sau khi chạy xong, hãy truy cập vào hệ thống trên trình duyệt:
* Nhấn `Ctrl + F5` để tải lại giao diện.
* Kiểm tra thanh Menu:
  * **Chế độ Người dùng**: Hiển thị đúng 6 nhóm menu Người dùng (Tổng quan, Yêu cầu khoa phòng, Giám định & Kiểm tra BHYT, Vật tư & Thiết bị, Nhân sự & Lịch trực, Tra cứu & Tiện ích).
  * **Chế độ Quản trị (ADMIN)**: Hiển thị đúng 6 nhóm menu Quản trị (Tổng hợp hệ thống, Người dùng & Phân quyền, Quản trị danh mục, Cấu hình quy tắc BHYT, Thiết kế & Giao diện, Giám sát & An toàn).
