# HƯỚNG DẪN NGHIỆP VỤ & TÀI LIỆU KỸ THUẬT: DANH SÁCH LỊCH TRỰC KẾ HOẠCH BỆNH VIỆN

Biểu mẫu: **Danh sách Lịch Trực Kế Hoạch Tuần (Toàn Viện / Khoa Phòng)**  
Căn cứ: Quy chế Trực Bệnh viện theo Thông tư liên tịch của Bộ Y tế & Bộ Nội vụ.

---

## 1. Mục Đích & Nguyên Tắc Hiển Thị

### 1.1 Mục đích sử dụng
- Tổng hợp và công khai lịch trực tuần của tất cả các khoa/phòng trong bệnh viện phục vụ công tác điều hành của Ban Giám đốc, Phòng Kế hoạch tổng hợp, Trực ban và các khoa lâm sàng/cận lâm sàng khi cần phối hợp cấp cứu.
- Mặc định ngày hiện tại khi truy cập đường dẫn, cho phép gọi điện thoại nhanh cho cán bộ trực khi có tình huống khẩn cấp.

### 1.2 Nguyên tắc hiển thị thông minh
- **Chỉ hiển thị khoa/phòng có lịch trực**: Tự động ẩn các phòng ban không có phân công trực trong tuần để bảng không bị loãng dữ liệu (có switch bật/tắt nếu cần kiểm tra).
- **Tự co giãn nội dung trong 1 ô**:
  - *Nếu khoa chỉ có Trực chính*: Hiển thị duy nhất 1 dòng gọn gàng: `🟢 BS. Nguyễn Văn A (0912.xxx.xxx)`.
  - *Nếu khoa có thêm Trực kèm hoặc Thường trú*: Tự động mở rộng thêm dòng `🔵 Kèm: ...` và `🟣 T.Trú: ...`.
  - *Nếu không có trực*: Hiển thị dấu `-`.
- **Nhận diện ngày hôm nay**: Cột ngày hiện tại được đóng khung viền nổi bật và gắn huy hiệu `Hôm nay`.

---

## 2. API Routes

### Lấy Danh Sách Lịch Trực Tuần
- **Endpoint**: `GET /api/staff/attendance/duty-schedule`
- **Query Params**:
  - `startDate`: Ngày bắt đầu tuần (YYYY-MM-DD, Thứ 2)
  - `endDate`: Ngày kết thúc tuần (YYYY-MM-DD, Chủ nhật)
  - `ma_khoa`: Mã khoa/phòng (tùy chọn, mặc định `ALL`)
  - `onlyWithDuties`: `true` (mặc định - chỉ lấy khoa có trực) hoặc `false`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "startDate": "2026-11-16",
    "endDate": "2026-11-22",
    "todayStr": "2026-11-14",
    "weekDays": [
      {
        "dateStr": "2026-11-16",
        "dayName": "Thứ 2",
        "formattedDate": "16/11",
        "isToday": false,
        "isWeekend": false
      }
    ],
    "departments": [
      {
        "stt": 1,
        "ma_khoa": "K02",
        "ten_khoa": "Khoa Cấp cứu",
        "totalDuties": 14,
        "schedule": {
          "2026-11-16": {
            "trucChinh": [{ "ho_ten": "BS. Nguyễn Văn A", "so_dien_thoai": "0912..." }],
            "trucKem": [{ "ho_ten": "ĐD. Trần Thị B" }],
            "thuongTru": []
          }
        }
      }
    ]
  }
  ```

---

## 3. Hướng Dẫn Thao Tác Cho Người Dùng

1. **Truy cập Lịch trực**:
   - Từ Bảng Chấm Trực (`/staff/attendance/duty`), bấm nút **"📅 Xem Danh Sách Lịch Trực Tuần"**.
   - Hoặc truy cập trực tiếp đường link: `/staff/attendance/duty/schedule`.
2. **Xem và tra cứu**:
   - Hệ thống tự động mở Tuần hiện tại và đánh dấu cột **Hôm nay**.
   - Sử dụng ô tìm kiếm để tìm nhanh tên Bác sĩ, Điều dưỡng, SĐT hoặc Tên khoa.
   - Bấm vào số điện thoại hiển thị trên ô để thực hiện cuộc gọi khẩn cấp.
3. **Xuất Excel & In ấn**:
   - Bấm **"Xuất Excel Lịch Trực Tuần"** để tải file Excel chuẩn mẫu gửi Ban Giám đốc.
   - Bấm **"In Lịch Trực"** để in bản A4 ngang dán bảng thông báo.

