# HƯỚNG DẪN SAO LƯU (BACKUP) VÀ PHỤC HỒI DỮ LIỆU (DISASTER RECOVERY)
HỆ THỐNG QUẢN LÝ BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN (HTQLBENHVIEN)

---

## 1. TỔNG QUAN VỀ DỮ LIỆU CẦN BẢO VỆ

Khi đưa hệ thống vào vận hành thực tế tại Bệnh viện, toàn bộ dữ liệu nghiệp vụ quan trọng được lưu trữ ở 3 thành phần:

| Thành phần | Đường dẫn / Vị trí | Mô tả nội dung |
| :--- | :--- | :--- |
| **Cơ sở dữ liệu PostgreSQL** | Container `htqlbenhvien-db`, volume `htql-prod-data` | Chứa tài khoản, vai trò, phiếu yêu cầu CNTT, lịch trực, danh mục cấp bậc, kho vật tư... |
| **Tệp tin tải lên (Uploads)** | Thư mục host `./public/uploads` | Hình ảnh lỗi, file biên bản, tài liệu đính kèm của người dùng |
| **Cấu hình môi trường** | File `./.env` | Chuỗi kết nối Database và các biến mật khẩu quan trọng |

Toàn bộ các bản sao lưu sẽ được nén và lưu trữ tại thư mục:  
📁 `./backups/YYYYMMDD_HHMMSS/`

---

## 2. CHIẾN LƯỢC SAO LƯU (3 LỚP BẢO HIỂM)

### Lớp 1: Tự động sao lưu trước mỗi lần cập nhật hệ thống
* Trong file `update-server.sh`, hệ thống đã được cài đặt tự động gọi `./backup.sh` ở **Bước 0**.
* Bất kỳ khi nào quản trị viên chạy lệnh cập nhật:
  ```bash
  ./update-server.sh
  ```
  Hệ thống sẽ **tự động chụp lại một bản sao lưu toàn bộ** dữ liệu hiện tại trước khi kéo code và build container mới. Nếu có bất kỳ sự cố gì sau khi update, dữ liệu cũ luôn còn nguyên.

---

### Lớp 2: Sao lưu tự động hàng ngày lúc 01:00 Sáng (Cronjob)
Để hệ thống tự động sao lưu định kỳ mỗi đêm trên máy chủ Linux:

1. Mở bảng lập lịch Cronjob trên Server:
   ```bash
   crontab -e
   ```
2. Thêm dòng sau vào cuối file (thay `/path/to/htqlbenhvien` bằng đường dẫn thực tế của dự án trên server, ví dụ `/data/htqlbenhvien` hoặc `/home/admin/htqlbenhvien`):
   ```cron
   0 1 * * * cd /path/to/htqlbenhvien && bash backup.sh >> /path/to/htqlbenhvien/backups/cron.log 2>&1
   ```
3. Lưu lại (`Ctrl + O`, `Enter`, `Ctrl + X` nếu dùng nano).

> [!NOTE]
> * File `backup.sh` đã có sẵn cơ chế **tự động dọn dẹp các bản sao lưu cũ hơn 14 ngày**, do đó không lo bị đầy dung lượng ổ cứng của máy chủ.

---

### Lớp 3: Sao lưu thủ công tức thì (Khi cần)
Trước khi thực hiện các tác vụ can thiệp lớn vào dữ liệu hoặc trước giờ bảo trì:
```bash
./backup.sh
```
Kết quả sao lưu sẽ hiển thị dạng:
```text
✅ Đã sao lưu DB thành công: /.../backups/20261027_085000/db_htqldb.sql.gz
✅ Đã sao lưu uploads thành công: /.../backups/20261027_085000/uploads.tar.gz
🎉 HOÀN TẤT BACKUP THÀNH CÔNG!
```

---

## 3. HƯỚNG DẪN PHỤC HỒI DỮ LIỆU KHI CÓ SỰ CỐ (RESTORE)

Khi xảy ra sự cố (thao tác nhầm dữ liệu, muốn quay lại ngày hôm trước, chuyển đổi máy chủ...), thực hiện các bước sau:

### Cách 1: Phục hồi theo menu lựa chọn trực quan
Chỉ cần gõ:
```bash
./restore.sh
```
Hệ thống sẽ tự động tìm và liệt kê 5 bản sao lưu gần nhất:
```text
📋 Danh sách 5 bản sao lưu gần nhất:
  [1] backups/20261027_085000
  [2] backups/20261026_010000
  [3] backups/20261025_010000
👉 Nhập số thứ tự bản sao lưu muốn phục hồi [1-3] (hoặc nhấn 'q' để hủy): 1
```
Hệ thống sẽ yêu cầu xác nhận lần cuối:
```text
Bạn có chắc chắn 100% muốn phục hồi dữ liệu? (Gõ 'yes' để xác nhận): yes
```

### Cách 2: Chỉ định trực tiếp thư mục bản sao lưu
```bash
./restore.sh backups/20261027_085000
```

Quy trình tự động của `restore.sh`:
1. Ngắt toàn bộ các kết nối hiện tại tới PostgreSQL.
2. Làm sạch schema và nạp lại toàn bộ cấu trúc + dữ liệu từ file `db_*.sql.gz`.
3. Giải nén và phục hồi toàn bộ file đính kèm `public/uploads` và cấp đúng quyền cho Docker.
4. Tự động khởi động lại container ứng dụng `htqlbenhvien-app` để làm mới bộ nhớ đệm.

---

## 4. TỰ ĐỘNG ĐỒNG BỘ BACKUP VỀ MÁY TÍNH WINDOWS (OFFSITE BACKUP)

Để phòng chống rủi ro hỏng hóc máy chủ chính, hệ thống cung cấp sẵn file `sync-backup-from-server.bat` để tự động kéo bản sao lưu từ Server về ổ `D:\Backup_BVDKLS` trên máy tính cá nhân.

### Bước 1: Cấu hình SSH Key để không cần gõ mật khẩu (Chỉ làm 1 lần)
1. Mở cửa sổ **Command Prompt (CMD)** hoặc **PowerShell** trên máy tính Windows, gõ:
   ```cmd
   ssh-keygen -t rsa -b 4096
   ```
   *(Nhấn `Enter` 3 lần khi được hỏi để tạo khóa mặc định)*

2. Đẩy khóa lên Server Linux:
   - Cách 1 (Nếu Windows có lệnh `ssh-copy-id`):
     ```cmd
     ssh-copy-id root@192.168.3.98
     ```
   - Cách 2 (Nếu không có lệnh trên): Mở file `C:\Users\Tên_Bạn\.ssh\id_rsa.pub`, copy toàn bộ nội dung và dán vào cuối file `~/.ssh/authorized_keys` trên Server Linux.
3. Kiểm tra bằng cách gõ: `ssh root@192.168.3.98`. Nếu vào được luôn mà không hỏi mật khẩu là đã thành công 100%!

---

### Bước 2: Chạy kiểm tra file `sync-backup-from-server.bat`
1. Mở file `sync-backup-from-server.bat` kiểm tra các thông số ở đầu file:
   - `SERVER_IP`: IP máy chủ (mặc định: `192.168.3.98`)
   - `SERVER_USER`: Tài khoản SSH (mặc định: `root`)
   - `REMOTE_BACKUP_DIR`: Thư mục lưu backup trên server (mặc định: `/root/htqlbenhvien/backups`)
   - `LOCAL_BACKUP_DIR`: Thư mục lưu trên máy tính (mặc định: `D:\Backup_BVDKLS`)
2. Nhấp đúp chuột vào file `sync-backup-from-server.bat` để chạy thử: Toàn bộ bản sao lưu trên server sẽ được tải về ổ `D:\Backup_BVDKLS`.

---

### Bước 3: Đặt lịch tự động hàng ngày qua Windows Task Scheduler
Để máy tính tự động tải mỗi ngày mà không cần bấm chuột:
1. Nhấn phím `Windows + R`, gõ `taskschd.msc` và nhấn `Enter`.
2. Chọn menu bên phải: **Create Basic Task...**
   - **Name**: `DongBoBackup_BenhVien`
   - **Trigger**: Chọn `Daily` (Hàng ngày) -> Đặt giờ chạy lúc **02:00:00 AM** (chạy sau khi server backup lúc 01:00 AM).
   - **Action**: Chọn `Start a program`.
   - **Program/script**: Bấm *Browse* trỏ tới file `sync-backup-from-server.bat`.
   - **Add arguments**: Điền `/quiet` (để script chạy ngầm không cần dừng chờ bấm phím).
3. Bấm **Finish** để hoàn tất.

*Từ nay về sau, mỗi ngày máy tính Windows sẽ tự động lưu trữ một bản sao lưu mới nhất và tự động xóa các bản cũ hơn 30 ngày để tiết kiệm dung lượng.*
