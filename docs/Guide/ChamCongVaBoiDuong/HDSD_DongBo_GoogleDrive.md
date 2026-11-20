# Hướng Dẫn Sử Dụng & Tài Liệu Kỹ Thuật: Đồng Bộ Mẫu Excel Chấm Công Lên Google Drive

## 1. Giới Thiệu & Mục Đích Nghiệp Vụ
Trong hoạt động quản lý nhân sự và chấm công tại Bệnh viện Đa khoa Lạng Sơn, để đảm bảo an toàn dữ liệu, phòng ngừa rủi ro khi hệ thống gặp sự cố máy chủ hoặc lỗi mạng đột xuất, chức năng **Đồng Bộ & Sao Lưu Tự Động Lên Google Drive** cho phép mỗi Khoa/Phòng (hoặc từng tài khoản quản trị) cấu hình lưu trữ dự phòng 5 mẫu bảng biểu chấm công chuẩn:
1. **Bảng Chấm Công Chuẩn Mẫu** (Tổng hợp ngày công, ký hiệu +, x, Nb, P...)
2. **Bảng Chấm Trực (Kèm & Thường Trú)** (Phân loại ca thường, T7/CN, Lễ/Tết)
3. **Sổ Theo Dõi & Đối Soát Nghỉ Bù** (Chi tiết ca trực đã nghỉ, hạn mức và số dư)
4. **Bảng Chấm Thêm Giờ** (Tổng số giờ làm thêm ngày, giờ làm thêm đêm)
5. **Bảng Chấm Độc Hại & Bồi Dưỡng Hiện Vật** (Mức hưởng bồi dưỡng theo ca làm việc độc hại)

Cấu trúc thư mục được hệ thống tự động khởi tạo trên Google Drive:
```text
Google Drive của Khoa / Cá nhân
└── ChamCong_BVDKLS/
    └── [Tên Khoa Phòng]/
        └── Nam_[YYYY]/
            └── Thang_[MM]/
                ├── BangChamCong_KP046_2026-11.xlsx
                ├── BangChamTruc_KP046_2026-11.xlsx
                ├── SoTheoDoiNghiBu_KP046_2026-11.xlsx
                ├── BangChamThemGio_KP046_2026-11.xlsx
                └── BangChamDocHai_KP046_2026-11.xlsx
```

---

## 2. Thiết Kế Cơ Sở Dữ Liệu (Prisma Schema)

Model `StaffAttendanceDriveConfig` lưu cấu hình đồng bộ linh hoạt theo từng khoa hoặc từng tài khoản người dùng:

| Trường (Field) | Kiểu dữ liệu | Ý nghĩa & Mô tả |
| :--- | :--- | :--- |
| `id` | `String` (UUID) | Khóa chính của bản ghi |
| `ma_khoa` | `String?` | Mã khoa phòng áp dụng (nếu cấu hình theo khoa) |
| `user_id` | `String?` | ID tài khoản người dùng (nếu cấu hình riêng cho tài khoản) |
| `method` | `String` | Phương thức: `WEBHOOK` (Apps Script), `OAUTH` (Drive API), `SERVICE_ACCOUNT` (Tập trung) |
| `webhook_url` | `String?` | URL Web App Google Apps Script đã deploy quyền "Anyone" |
| `access_token` | `String?` | Access Token hoặc Refresh Token của tài khoản Google OAuth |
| `refresh_token`| `String?` | Token tự động làm mới phiên kết nối OAuth |
| `folder_id` | `String?` | ID thư mục Google Drive đích tùy chỉnh (nếu muốn chỉ định) |
| `folder_name` | `String?` | Tên thư mục gốc (mặc định: `ChamCong_BVDKLS`) |
| `is_auto_sync` | `Boolean` | Tự động đồng bộ sau khi chốt công tháng (mặc định: `true`) |
| `last_sync_at` | `DateTime?` | Thời điểm thực hiện đồng bộ gần nhất |
| `last_sync_status` | `String?` | Trạng thái đồng bộ gần nhất (`SUCCESS`, `FAILED`...) |
| `last_sync_log` | `String?` | Nội dung chi tiết hoặc lỗi trong lần đồng bộ gần nhất |
| `created_at` | `DateTime` | Thời gian tạo cấu hình |
| `updated_at` | `DateTime` | Thời gian cập nhật cấu hình lần cuối |

---

## 3. Danh Sách API Routes

### 3.1. Lấy và Lưu Cấu Hình Google Drive
- **Endpoint**: `GET /api/staff/attendance/drive-sync/config`
  - **Query Params**: `ma_khoa` (ví dụ: `KP046`), `user_id` (tùy chọn)
  - **Response Thành Công (200)**:
    ```json
    {
      "success": true,
      "config": {
        "method": "WEBHOOK",
        "webhook_url": "https://script.google.com/macros/s/.../exec",
        "folder_name": "ChamCong_BVDKLS",
        "is_auto_sync": true,
        "last_sync_at": "2026-11-20T08:00:00.000Z",
        "last_sync_status": "SUCCESS"
      }
    }
    ```

- **Endpoint**: `POST /api/staff/attendance/drive-sync/config`
  - **Headers**: `Content-Type: application/json`
  - **Request Body**:
    ```json
    {
      "ma_khoa": "KP046",
      "method": "WEBHOOK",
      "webhook_url": "https://script.google.com/macros/s/AKfycbx.../exec",
      "folder_id": "",
      "folder_name": "ChamCong_BVDKLS",
      "is_auto_sync": true
    }
    ```
  - **Response (200)**:
    ```json
    { "success": true, "message": "Đã lưu cấu hình Google Drive thành công" }
    ```
  - **Mã lỗi thường gặp**:
    - `400 Bad Request`: Thiếu URL webhook hoặc phương thức không hợp lệ.
    - `500 Server Error`: Lỗi lưu cơ sở dữ liệu.

### 3.2. Kiểm Tra Kết Nối Thử Nghiệm (Test Drive Connection)
- **Endpoint**: `POST /api/staff/attendance/drive-sync/test`
  - **Headers**: `Content-Type: application/json`
  - **Request Body**:
    ```json
    {
      "method": "WEBHOOK",
      "webhook_url": "https://script.google.com/macros/s/AKfycbx.../exec"
    }
    ```
  - **Response Thành Công (200)**:
    ```json
    {
      "success": true,
      "message": "Kết nối Google Apps Script Webhook thành công! Đã tạo file test trên Drive.",
      "fileUrl": "https://drive.google.com/open?id=1AbCdEf..."
    }
    ```
  - **Mã lỗi thường gặp**:
    - `400 Bad Request`: Webhook URL không đúng định dạng.
    - `502 Bad Gateway`: Không thể kết nối tới Google Apps Script (do chưa cấp quyền Web App "Anyone").

### 3.3. Thực Thi Đồng Bộ 5 Bảng Excel Lên Google Drive
- **Endpoint**: `POST /api/staff/attendance/drive-sync/execute`
  - **Headers**: `Content-Type: application/json`
  - **Request Body**:
    ```json
    {
      "ma_khoa": "KP046",
      "monthYear": "2026-11",
      "filesToSync": ["CHAM_CONG", "CHAM_TRUC", "SO_DOI_SOAT", "CHAM_THEM_GIO", "CHAM_DOC_HAI"]
    }
    ```
  - **Response Thành Công (200)**:
    ```json
    {
      "success": true,
      "message": "Đã đồng bộ 5/5 file Excel lên Google Drive thành công",
      "syncedFiles": [
        { "type": "CHAM_CONG", "fileName": "BangChamCong_KP046_2026-11.xlsx", "status": "SUCCESS" },
        { "type": "CHAM_TRUC", "fileName": "BangChamTruc_KP046_2026-11.xlsx", "status": "SUCCESS" },
        { "type": "SO_DOI_SOAT", "fileName": "SoTheoDoiNghiBu_KP046_2026-11.xlsx", "status": "SUCCESS" },
        { "type": "CHAM_THEM_GIO", "fileName": "BangChamThemGio_KP046_2026-11.xlsx", "status": "SUCCESS" },
        { "type": "CHAM_DOC_HAI", "fileName": "BangChamDocHai_KP046_2026-11.xlsx", "status": "SUCCESS" }
      ],
      "folderUrl": "https://drive.google.com/drive/folders/..."
    }
    ```
  - **Mã lỗi thường gặp**:
    - `400 Bad Request`: Chưa cấu hình Google Drive hoặc thiếu tham số tháng năm.
    - `500 Server Error`: Quá trình sinh file Excel hoặc tải file lên bị gián đoạn.

---

## 4. Các Component Giao Diện (Frontend Components)

### 4.1. Modal Cấu Hình: `AttendanceDriveConfigModal.tsx`
- **Mục đích**: Cung cấp giao diện 3 tab tương ứng 3 phương thức lưu trữ:
  1. **Tab 1 - Google Apps Script (Khuyên dùng)**: Người dùng copy đoạn mã mẫu có sẵn, mở [script.google.com](https://script.google.com), dán vào và nhấn "Triển khai dưới dạng ứng dụng web" (Deploy as Web App). Sau đó dán URL Webhook vào ô và bấm "Kiểm tra kết nối".
  2. **Tab 2 - Google Drive API (OAuth 2.0)**: Cấu hình Client ID, Client Secret dành cho khoa phòng có chuyên môn kỹ thuật hoặc tài khoản Google Workspace.
  3. **Tab 3 - Drive Tập Trung Bệnh Viện**: Chế độ tích hợp dành cho Quản trị viên Phòng CNTT kết nối với Service Account tổng.
- **Props**:
  - `open: boolean`: Trạng thái hiển thị modal.
  - `onClose: () => void`: Hàm đóng modal.
  - `maKhoa: string`: Mã khoa phòng hiện tại.
  - `tenKhoa: string`: Tên khoa phòng hiển thị.

### 4.2. Modal Tiến Trình Đồng Bộ: `AttendanceDriveSyncModal.tsx`
- **Mục đích**: Cho phép người dùng chọn danh sách các bảng cần đồng bộ, theo dõi thanh tiến trình (Progress bar) và nhật ký đồng bộ từng file thời gian thực.
- **Tính năng nổi bật**:
  - Tự động tick chọn cả 5 bảng.
  - Sau khi đẩy file thành công có nút mở trực tiếp thư mục Google Drive để kiểm tra file.
  - Lưu vết lịch sử và trạng thái đồng bộ lên cơ sở dữ liệu.

### 4.3. Tích Hợp Trên Thanh Công Cụ: `layout.tsx`
- Bổ sung nút **"☁️ Cài Đặt Drive"** và **"☁️ Đồng Bộ Drive"** ngay góc phải thanh điều hướng.
- Bổ sung 2 mục vào Menu thả xuống của nút **"Xuất Excel Chuẩn Mẫu"**:
  - *☁️ Đồng bộ 5 bảng lên Google Drive*
  - *⚙️ Cài đặt Google Drive (3 phương thức)*

---

## 5. Hướng Dẫn Thao Tác Dành Cho Người Dùng (3 Bước Nhanh)

### Bước 1: Cấu hình tài khoản Google Drive
1. Nhấp nút **"☁️ Cài Đặt Drive"** trên thanh công cụ.
2. Tại **Phương thức 1 (Google Apps Script)**: Nhấp nút **"📋 Sao chép mã Google Apps Script"**.
3. Mở tab mới truy cập [https://script.google.com](https://script.google.com) > Nhấn **Dự án mới** > Dán đoạn mã đã sao chép > Nhấn **Triển khai (Deploy)** > **Triển khai mới** > Chọn loại **Ứng dụng web** (Web app) > Đặt mục *Ai có quyền truy cập* là **Bất kỳ ai (Anyone)**.
4. Sao chép liên kết Ứng dụng web và dán vào ô **Webhook URL** trong phần mềm.
5. Nhấn **"Kiểm tra kết nối"**, khi thấy báo thành công thì nhấn **"Lưu Cấu Hình"**.

### Bước 2: Thực hiện đồng bộ 5 bảng Excel
1. Nhấp nút **"☁️ Đồng Bộ Drive"** (hoặc mở từ menu **Xuất Excel Chuẩn Mẫu**).
2. Kiểm tra danh sách 5 bảng đã được chọn mặc định.
3. Nhấp nút **"Bắt đầu đồng bộ lên Drive"**.

### Bước 3: Kiểm tra tệp tin trên Google Drive
1. Hệ thống sẽ lần lượt tạo và tải 5 tệp Excel lên Google Drive của bạn.
2. Khi hoàn tất, nhấp vào liên kết **"Mở thư mục trên Google Drive"** để xem và tải về các file bảng chấm công dự phòng.

