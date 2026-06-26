# Hướng Dẫn Cấu Hình Bot Telegram Cho Hệ Thống Báo Lỗi IT

Tài liệu này hướng dẫn cách thiết lập và cấu hình Bot Telegram để hệ thống phần mềm Quản lý Bệnh viện (HTQL) có thể tự động gửi thông báo khi có yêu cầu hỗ trợ IT mới từ các khoa phòng.

---

## 1. Cơ Chế Hoạt Động

Hệ thống HTQL không sử dụng tài khoản cá nhân để gửi tin nhắn, thay vào đó hệ thống sử dụng **Telegram Bot API** để gửi thông báo tự động.
Khi có một sự cố mới được tạo (hoặc khi Khoa bấm nút hối thúc "Ping"), hệ thống sẽ:
1. Gửi tin nhắn thông báo chung vào **Group IT của Bệnh viện**.
2. Gửi tin nhắn **Trực tiếp (Direct Message)** cho nhân viên IT được phân công xử lý (nếu có).

---

## 2. Các Bước Khởi Tạo Bot (Dành cho Quản trị viên)

Để có một Bot Telegram, bạn cần dùng tài khoản Telegram của mình để tạo mới:

1. Mở ứng dụng Telegram, tìm kiếm tài khoản **`@BotFather`** (đây là bot chính chủ của Telegram có tích xanh).
2. Nhắn lệnh `/newbot` và làm theo hướng dẫn:
   - Nhập tên hiển thị cho Bot (Ví dụ: `Bot Cảnh Báo Sự Cố BV`).
   - Nhập username cho Bot (Phải kết thúc bằng chữ `bot`, ví dụ: `Bv_IT_Support_bot`).
3. Sau khi tạo thành công, BotFather sẽ cung cấp cho bạn một đoạn mã gọi là **HTTP API Token** (Ví dụ: `123456789:ABCdefGHIjklmNOPqrstuvwxyz`).
4. **Lưu ý:** Giữ bí mật đoạn Token này vì bất kỳ ai có nó đều có thể điều khiển Bot của bạn.

---

## 3. Cấu Hình Trên Server (Mã Nguồn)

Sau khi có Token và Group chat, Quản trị viên hệ thống cần cấu hình các biến môi trường cho phần mềm:

1. Mở file `.env` tại thư mục gốc của dự án (`d:\1.ProjectBVDKLS\htqlbenhvien\.env`).
2. Khai báo 2 biến sau:

```env
# Thay thế bằng Token lấy từ BotFather
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklmNOPqrstuvwxyz

# Thay thế bằng ID của Group nhận thông báo chung
TELEGRAM_CHAT_ID=-100123456789
```

**Cách lấy ID của Group Chat:**
- Thêm Bot bạn vừa tạo vào Group hỗ trợ IT.
- Thêm một Bot hỗ trợ lấy ID (ví dụ: `@RawDataBot` hoặc `@getmyid_bot`) vào Group để lấy chuỗi ID của Group (thường bắt đầu bằng dấu trừ `-100...`).

Sau khi cấu hình, hãy khởi động lại phần mềm (restart server).

---

## 4. Cấu Hình Tài Khoản Nhân Viên IT (Để nhận tin nhắn riêng)

Để nhân viên IT có thể nhận tin nhắn cá nhân (inbox) từ hệ thống khi được giao việc, nhân viên đó cần cập nhật thông tin trên phần mềm:

1. Đăng nhập vào phần mềm HTQL, vào **Quản lý Tài khoản**.
2. Mở form **Cập nhật Tài khoản** của nhân viên IT đó.
3. Tại ô **Tài khoản Telegram (@username hoặc ID)**:
   - **Cách 1 (Nhận tin nhắn cá nhân - Khuyên dùng):** Điền **ID Telegram dạng số** (Ví dụ: `987654321`). 
     - Để lấy ID này, nhân viên mở Telegram tìm bot `@userinfobot`, bot sẽ trả về ID của họ.
     - **QUAN TRỌNG:** Bot không thể tự động inbox cho người dùng lạ. Nhân viên IT **BẮT BUỘC** phải tìm kiếm Bot của bệnh viện (tạo ở bước 2) và bấm nút **"Start"** trước. Sau đó, hệ thống mới có thể gửi tin nhắn tự động cho nhân viên.
   - **Cách 2 (Chỉ dùng để Tag tên trong Group):** Điền username Telegram (Ví dụ: `@nguyenvana`). Khi có lỗi, hệ thống sẽ dùng chữ này để tag nhân viên trong Group, tuy nhiên sẽ không thể gửi tin nhắn riêng.

---

## 5. Các Mẫu Thông Báo

**Mẫu thông báo khi tạo phiếu báo lỗi mới:**
> 🚨 **YÊU CẦU HỖ TRỢ MỚI**
> 
> 🏢 **Khoa:** Khoa Khám Bệnh
> 👤 **Người báo:** Nguyễn Văn B - **SĐT:** 0987654321
> 📌 **Loại sự cố:** Phần Mềm / Nghiệp Vụ
> 📝 **Bệnh án:** 26/12345
> ❌ **Lỗi:** Lỗi không lưu được tờ điều trị
> 
> 🧑‍💻 **Người nhận:** Nguyễn Văn A

**Mẫu thông báo khi Khoa hối thúc (Ping):**
> 🔴 **HỐI THÚC XỬ LÝ (Lần 1)**
> 
> 🏢 **Khoa:** Khoa Khám Bệnh
> 👤 **Người báo:** Nguyễn Văn B
> 📝 **Bệnh án:** 26/12345
> ❌ **Lỗi:** Lỗi không lưu được tờ điều trị
> 🗒 **Ghi chú gửi lại:** Đang vội cho BN ra viện, nhờ IT xem gấp!
