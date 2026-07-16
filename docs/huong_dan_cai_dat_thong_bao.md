# Hướng dẫn Cài đặt & Sử dụng Hệ thống Thông báo (Desktop Tray App)

Tài liệu này hướng dẫn cách cấu hình, biên dịch phần mềm chạy ngầm và thiết lập tại máy tính của Khoa/Phòng để nhận thông báo tự động từ HTQL Bệnh Viện.

## 1. Cơ chế hoạt động (Phân luồng Khoa Phòng)
- Hệ thống hỗ trợ "Phân luồng thông báo": Tức là khi có một sự kiện phát sinh ở một khoa (ví dụ: Yêu cầu IT mới của Khoa Khám Bệnh - `KKB`), thì **CHỈ CÓ các máy tính đang cấu hình mã khoa là `KKB`** mới nhận được chuông và popup thông báo.
- Nếu có một sự kiện chung cho toàn bệnh viện (không giới hạn mã khoa), mọi máy tính đều sẽ nhận được.
- Quản trị viên (Admin) có thể chủ động **Bật/Tắt** các loại sự kiện thông báo thông qua giao diện Web Quản trị.

## 2. Hướng dẫn dành cho Admin (Quản trị Web)
1. Đăng nhập vào hệ thống HTQL Bệnh Viện bằng tài khoản Admin.
2. Truy cập vào trang: `[Địa_chỉ_web]/admin/notifications` (Hoặc tìm trong Menu nếu đã được cấu hình).
3. Tại đây, bạn sẽ thấy danh sách các "Sự kiện hệ thống" (Ví dụ: *Có yêu cầu hỗ trợ IT mới*).
4. Sử dụng nút Gạt (Toggle) bên cạnh để kích hoạt (Bật) hoặc hủy kích hoạt (Tắt) việc gửi thông báo cho sự kiện đó. Hệ thống sẽ tự động lưu lại.

## 3. Hướng dẫn dành cho IT (Đóng gói phần mềm)
Để cài đặt phần mềm lên máy của Khoa, bạn cần đóng gói mã nguồn `desktop-client` thành file chạy (`.exe` trên Windows).

**Các bước đóng gói (Build):**
1. Mở Command Prompt (Terminal) và di chuyển vào thư mục chứa mã nguồn client:
   ```bash
   cd D:\1.ProjectBVDKLS\htqlbenhvien\desktop-client
   ```
2. Cài đặt các thư viện Node.js:
   ```bash
   npm install
   ```
3. Cài đặt công cụ đóng gói (electron-builder):
   ```bash
   npm install --save-dev electron-builder
   ```
4. Bổ sung script build vào file `package.json`:
   ```json
   "scripts": {
     "start": "electron .",
     "build": "electron-builder -w"
   }
   ```
5. Chạy lệnh đóng gói:
   ```bash
   npm run build
   ```
   > File `.exe` cài đặt sẽ được tạo ra trong thư mục `dist/`. Chép file này vào USB để đi cài cho các máy khoa phòng.

## 4. Hướng dẫn Cài đặt tại máy Khoa Phòng
1. Chạy file `.exe` vừa copy vào máy trạm.
2. Ứng dụng sẽ tự động chạy ngầm, bạn sẽ thấy một **biểu tượng nhỏ (Icon)** xuất hiện ở góc dưới cùng bên phải màn hình (System Tray - Chỗ xem giờ).
3. **CẤU HÌNH BAN ĐẦU (Rất quan trọng):**
   - Nhấp chuột phải vào biểu tượng đó, chọn **"Cài đặt Server & Mã Khoa"**.
   - Một cửa sổ nhỏ hiện lên.
   - **URL Máy Chủ:** Nhập địa chỉ web của Bệnh viện (Ví dụ: `https://htqlbenhvien.bvdklangson.com.vn:201/htqlbenhvien` hoặc địa chỉ IP mạng LAN).
   - **Mã Khoa Phòng:** Nhập đúng mã khoa của máy tính đó. Ví dụ máy đặt ở Khoa Cấp Cứu thì nhập `KCC`, máy ở Khoa Khám Bệnh thì nhập `KKB`. *(Mã này phải khớp với mã KHOA trong cơ sở dữ liệu)*.
   - Nhấn **"Lưu & Kết nối"**.
4. Ứng dụng sẽ hiển thị tooltip "Đã kết nối". 
5. Từ lúc này, nhân viên chỉ cần để máy tính chạy bình thường. Khi có thông báo liên quan đến khoa của họ, máy tính sẽ nổ chuông và hiện hộp thoại. Nhấp vào hộp thoại sẽ tự mở trang web xem chi tiết.
