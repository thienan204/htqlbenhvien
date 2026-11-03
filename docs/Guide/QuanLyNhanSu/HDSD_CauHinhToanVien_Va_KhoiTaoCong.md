# Hướng Dẫn Nghiệp Vụ: Cấu Hình Chấm Công Toàn Viện & Khởi Tạo Công Đầu Tháng

## 1. Giới Thiệu Tổng Quan
Tính năng **Cấu Hình Chấm Công Toàn Viện** và **Khởi Tạo Công Cả Tháng** được xây dựng nhằm phục vụ công tác quản lý lao động, bảng chấm công, bảng trực và thêm giờ trên toàn bộ các Khoa / Phòng của Bệnh viện Đa khoa Lạng Sơn.

- **Độc lập dữ liệu**: Cấu hình chấm công toàn viện được quản lý tách biệt với các cấu hình phân hệ khác (như cấu hình sự cố CNTT tại `/error-management/config`), đảm bảo tính chuyên biệt và không gây xung đột nghiệp vụ.
- **Phân quyền truy cập**:
  - Nút **`⚙️ Cấu Hình Toàn Viện`**: Chỉ mở cho Ban Giám đốc, Quản trị viên (`ADMIN`) hoặc Phòng Tổ chức cán bộ (`TCCB`).
  - Nút **`⚡ Khởi Tạo Công Cả Tháng`**: Dành cho Lãnh đạo Khoa / Điều dưỡng trưởng được phân quyền chấm công tại từng khoa phòng.

---

## 2. Các Chức Năng Chính Trong Cấu Hình Toàn Viện

Giao diện hộp thoại **Cấu Hình Toàn Viện** gồm 3 thẻ (Tabs chuẩn `type="card"`):

### 2.1. Thẻ 1: 🏖️ Ngày Nghỉ Lễ, Tết & Hoán Đổi
- **Mặc định luật định**: Tự động tích hợp sẵn các ngày lễ lớn theo Bộ luật Lao động Việt Nam (Tết Dương lịch 01/01, Giỗ Tổ Hùng Vương 10/03 Âm lịch, 30/04, 01/05, Quốc khánh 02/09).
- **Khai báo linh hoạt**:
  - Khai báo theo **ngày đơn** hoặc theo **dải ngày liên tục** (thuận tiện chọn lịch nghỉ Tết Nguyên đán 7-9 ngày chỉ với 1 thao tác).
  - Khai báo ngày nghỉ lễ bù, ngày nghỉ hoán đổi theo thông báo của Ban Giám đốc / UBND tỉnh.
  - Chọn hệ số ngày nghỉ bù khi trực lễ (mặc định là ⭐ 2.0 ngày bù theo quy chế bệnh viện).
- **Hiệu ứng trên bảng công**: Ngày lễ được tô màu nền tím nổi bật, hiển thị tên ngày lễ khi rê chuột và tự động cộng dồn 2 ngày bù khi cán bộ trực vào ngày lễ này.

### 2.2. Thẻ 2: 💼 Ngày Làm Bù Thứ 7, Chủ Nhật
- Dành cho các đợt hoán đổi ngày làm việc (nghỉ liền chuỗi và làm bù vào Thứ 7 tuần kế tiếp).
- **Hiệu lực hệ thống**: Khi một ngày Thứ 7 hoặc Chủ Nhật được đăng ký làm bù:
  - Bảng chấm công sẽ **mở khóa** ngày này (không còn bị đánh dấu là ngày nghỉ cuối tuần).
  - Nút **`Chấm Nhanh Ngày`** và **`⚡ Khởi Tạo Công Cả Tháng`** sẽ tự động cho phép điền công hành chính vào ngày này.

### 2.3. Thẻ 3: ⏰ Khung Giờ Hành Chính Chuẩn
- Cấu hình giờ bắt đầu / kết thúc ca sáng (07:00 - 11:30) và ca chiều (13:30 - 17:00).
- Tiêu chuẩn số giờ làm việc chuẩn mỗi ngày (8.0 giờ), phục vụ tính toán bảng Chấm thêm giờ.

---

## 3. Cơ Chế Hoạt Động Của Nút "⚡ Khởi Tạo Công Cả Tháng"

Khi Lãnh đạo Khoa bấm **`⚡ Khởi Tạo Công Cả Tháng`**:
1. **Lọc ngày làm việc**:
   - **Mặc định chỉ điền Thứ 2 đến Thứ 6**: Hệ thống tự động bỏ qua toàn bộ Thứ 7 và Chủ Nhật.
   - **Tự động bỏ qua Ngày Lễ / Tết**: Tất cả các ngày nằm trong danh mục Ngày Lễ toàn viện đã cấu hình sẽ không bị điền công hành chính.
   - **Tự động mở cho Ngày Làm Bù**: Nếu có ngày Thứ 7 được chỉ định làm bù toàn viện, hệ thống sẽ tự động điền công cho ngày đó.
2. **Ký hiệu công chuẩn**:
   - Khoa CNTT (`KP046`): Điền ký hiệu `x` (Đi làm cả ngày).
   - Các khoa lâm sàng và khoa phòng khác: Điền ký hiệu `+` (Công đi làm chuẩn mẫu bệnh viện).
3. **An toàn dữ liệu (Zero Overwrite)**:
   - Các ô đã được phân công trực, chấm nghỉ phép (`P`), nghỉ bù (`Nb`), công tác (`CT`)... sẽ **giữ nguyên**, không bị ghi đè.

---

## 4. Tài Liệu Kỹ Thuật API

### 4.1. Lấy & Lưu Cấu Hình Toàn Viện
- **URL**: `/api/staff/attendance/config`
- **Method**: `GET` | `POST`
- **Quyền hạn**:
  - `GET`: Tất cả người dùng đã đăng nhập.
  - `POST`: `ADMIN` hoặc `TCCB`.

#### Request Body (`POST`):
```json
{
  "holidays": [
    {
      "id": "tet-duong-lich",
      "date": "2026-01-01",
      "name": "Tết Dương lịch",
      "allowanceDays": 2.0
    }
  ],
  "makeupWorkdays": [
    {
      "id": "bu-thu7-01",
      "date": "2026-05-04",
      "description": "Làm bù cho ngày nghỉ hoán đổi 02/05"
    }
  ],
  "workHours": {
    "morningStart": "07:00",
    "morningEnd": "11:30",
    "afternoonStart": "13:30",
    "afternoonEnd": "17:00",
    "standardDailyHours": 8.0
  }
}
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Đã lưu cấu hình chấm công toàn viện thành công",
  "config": { ... }
}
```

### 4.2. Khởi Tạo Công Cả Tháng
- **URL**: `/api/staff/attendance/init-month`
- **Method**: `POST`
- **Request Body**:
```json
{
  "ma_khoa": "KP046",
  "monthYear": "2026-11",
  "overwrite": false
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Đã khởi tạo công cho 15 nhân viên (tổng 330 lượt công, bỏ qua Thứ 7, CN và ngày Lễ)"
}
```
