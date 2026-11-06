# Hướng Dẫn Sử Dụng & Tài Liệu Kỹ Thuật: Phân Hệ Chấm Công & Chấm Trực Toàn Viện

Phân hệ quản lý chấm công hành chính và chấm công thường trực chuyên môn y tế áp dụng cho **toàn bộ 42 khoa/phòng trong Bệnh viện Đa khoa tỉnh Lạng Sơn** (Phòng CNTT, Khoa Y học cổ truyền, Khoa Cấp cứu, Khoa Khám bệnh, Khoa Nội, Khoa Ngoại...), đối soát chuẩn xác 100% theo các file mẫu:
- `mau/staff/Bảng chấm công từ T6.2025.xlsx`
- `mau/staff/Bảng chấm trực.xlsx` (Mẫu C01b-YT theo QĐ 144-BHYT/QĐ)
- `mau/staff/Copy of THÁNG 9.xls` (Mẫu thực tế của Khoa Y học cổ truyền)

---

## 1. TỔNG QUAN PHÂN HỆ

### 1.1. Mục đích
- Cho phép Lãnh đạo khoa / Điều dưỡng trưởng / Thư ký của **bất kỳ khoa phòng nào** chấm công và chấm trực hàng ngày trên bảng ma trận trực quan (ngày 1 đến 31).
- Quản trị viên (`ADMIN`) và Phòng Tổ chức cán bộ có thể chuyển đổi nhanh qua lại giữa **42 khoa phòng** để theo dõi và kiểm tra.
- Hỗ trợ linh hoạt cả ký hiệu **`x`** (khối hành chính, CNTT) và **`+`** (khối lâm sàng) đều được tính công hưởng lương thời gian trọn vẹn.
- Tự động hóa quy trình quản lý **Nghỉ Bù (`Nb`, `Nb1/2`, `Nb/x`)**: Bắt buộc gắn với ca trực, theo dõi hạn mức, hỗ trợ nghỉ cả ngày hoặc nửa ngày sáng/chiều.
- Tự động áp dụng luật lao động: **Trực ngày Lễ/Tết được hưởng hạn mức nghỉ bù 2 ngày** (so với 1 ngày của trực thường/chủ nhật).
- **Tự động đồng bộ sang Quản lý yêu cầu CNTT (`/error-management/it-requests`)** cho các kỹ thuật viên tiếp nhận sự cố.
- Cho phép từng cán bộ, y bác sĩ đăng nhập xem lịch công, lịch trực và quỹ ngày nghỉ bù của chính mình.
- Cuối tháng xuất file Excel chuẩn 100% định dạng, **tự động in tên Khoa/Phòng và tên Trưởng khoa/Phụ trách khoa** vào phần chữ ký.

### 1.2. Đường dẫn truy cập
- **Quản lý Chấm công & Chấm trực**: `/htqlbenhvien/staff/attendance-manager`
- **Lịch Công & Trực của Tôi**: `/htqlbenhvien/staff/my-attendance`
- **Thanh công cụ trang Quản lý Nhân sự**: Nút `Bảng Chấm Công & Trực` tại `/htqlbenhvien/staff`.

---

## 2. QUY TRÌNH THAO TÁC NGƯỜI DÙNG (USER GUIDE)

### 2.1. Thao tác dành cho Lãnh đạo / Thư ký các Khoa Phòng
1. **Truy cập**: Vào menu *Nhân sự* $\rightarrow$ Bấm nút tím **`Bảng Chấm Công & Trực`**.
2. **Chọn Khoa / Phòng**:
   - Nếu là Quản trị viên / Phòng TCCB: Chọn khoa phòng cần xem trong ô chọn (hỗ trợ tìm kiếm nhanh theo tên hoặc mã khoa).
   - Nếu là người dùng của khoa: Hệ thống tự động mở đúng khoa phòng của bạn.
3. **Chọn tháng**: Sử dụng bộ chọn tháng ở góc trên bên phải (mặc định tháng hiện tại).
4. **Chấm nhanh đi làm hôm nay**:
   - Bấm nút vàng **`Chấm Nhanh Hôm Nay`** để điền công (`x` cho khối phòng ban hoặc `+` cho khối lâm sàng) cho toàn bộ cán bộ trong khoa.
5. **Chấm thủ công trên từng ô**:
   - Click chuột vào ô của cán bộ tại ngày tương ứng.
   - Chọn ký hiệu mong muốn: `x` hoặc `+` (đi làm), `P` (nghỉ phép), `L` (nghỉ lễ), `H` (đi học), `Ô` (nghỉ ốm), `TS` (thai sản), `KL` (không lương).
5. **Quy trình Chấm Nghỉ Bù (`Nb`)**:
   - Nhấp vào ô $\rightarrow$ Chọn **`Nb - Nghỉ bù`**.
   - Hộp thoại thông minh mở ra:
     + Chọn ca trực cần trừ ngày bù (hệ thống chỉ hiển thị các ca trực còn dư ngày bù).
     + Chọn phạm vi: *Nghỉ bù cả ngày (`Nb`)*, *Nghỉ bù sáng (`Nb/x`)*, *Nghỉ bù chiều (`x/Nb`)* hoặc *Chỉ nghỉ nửa ngày (`1/2Nb`)*.
     + Bấm **`Xác nhận Lưu Nghỉ Bù`**. Ca trực sẽ tự động bị trừ số ngày bù tương ứng.
6. **Chấm Ca Trực**:
   - Chuyển sang Tab **`2. Bảng Chấm Trực (Mẫu C01b - YT)`**.
   - Click vào ô ngày trực của cán bộ $\rightarrow$ Chọn:
     + `T`: Trực ngày thường (hạn mức bù 1 ngày).
     + `C`: Trực Thứ Bảy, Chủ Nhật (hạn mức bù 1 ngày).
     + `L`: Trực Ngày Lễ (⭐ hạn mức bù 2 ngày theo luật).
     + `Te`: Trực Tết (⭐ hạn mức bù 2 ngày theo luật).
7. **Đối soát quỹ nghỉ bù**:
   - Chuyển sang Tab **`3. Sổ Theo Dõi & Đối Soát Nghỉ Bù`** để xem tổng số ca trực, số ngày đã bù và số ngày còn dư của 8 cán bộ.
8. **Xuất file Excel cuối tháng**:
   - Bấm nút **`Xuất Excel Chuẩn Mẫu`** $\rightarrow$ Chọn *1. Xuất Bảng Chấm Công* hoặc *2. Xuất Bảng Chấm Trực*. File Excel sẽ tải về máy tính với đầy đủ công thức và chữ ký.

---

### 2.2. Thao tác dành cho Nhân viên CNTT
1. Đăng nhập vào hệ thống bằng tài khoản cá nhân.
2. Truy cập vào **`/htqlbenhvien/staff/my-attendance`** (hoặc bấm nút *Lịch Của Tôi* tại trang Nhân sự).
3. Màn hình hiển thị:
   - Thẻ thống kê: Số công hưởng lương, Số ca trực tháng, Số ngày đã nghỉ bù, Quỹ ngày trực còn dư có thể xin nghỉ bù.
   - Bảng ca trực chưa nghỉ bù: Biết rõ ca trực ngày nào chưa bù để chủ động xin nghỉ.
   - Lịch chi tiết từng ngày trong tháng kèm ghi chú ca trực và ngày nghỉ bù.

---

## 3. TÀI LIỆU BACKEND APIS

### 3.1. API Lấy Bảng Ma Trận Công & Trực
- **Endpoint**: `GET /api/staff/attendance/matrix`
- **Query Params**:
  - `monthYear` (String, tùy chọn): Định dạng `YYYY-MM` (mặc định tháng hiện tại, ví dụ: `2026-10`).
  - `ma_khoa` (String, tùy chọn): Mã khoa phòng (mặc định: `KP046`).
- **Response**:
  ```json
  {
    "monthYear": "2026-10",
    "year": 2026,
    "month": 10,
    "ma_khoa": "KP046",
    "ten_khoa": "Phòng Công nghệ thông tin",
    "daysInMonth": 31,
    "daysInfo": [
      { "day": 1, "dateStr": "2026-10-01", "dayOfWeek": 4, "isWeekend": false }
    ],
    "staffData": [
      {
        "stt": 1,
        "staffId": "...",
        "ho_ten": "Lâm An Biên",
        "chuc_vu": "Trưởng phòng",
        "attendanceMap": { "1": { "code": "x", "value": 1.0 } },
        "dutyMap": { "5": { "dutyCode": "T", "allowanceDays": 1.0 } },
        "attendanceSummary": { "luongThoiGian": 22, "nghiKhongLuong": 0, "huongBHXH": 0 },
        "dutySummary": { "ngayThuong": 4, "t7cn": 2, "leTet": 0, "tongSo": 6 }
      }
    ]
  }
  ```

### 3.2. API Lấy Danh Sách Ca Trực Có Thể Nghỉ Bù
- **Endpoint**: `GET /api/staff/attendance/available-duties`
- **Query Params**:
  - `staffId` (String, bắt buộc): ID nhân sự.
  - `beforeDate` (String, tùy chọn): Lọc các ca trực trước hoặc trong ngày chấm công.
- **Response**: Danh sách ca trực có `remainingDays > 0`.

### 3.3. API Cập Nhật Ô Công / Ô Trực
- **Endpoint**: `POST /api/staff/attendance/update-cell`
- **Request Body (JSON)**:
  ```json
  {
    "type": "ATTENDANCE",
    "staffId": "...",
    "ma_khoa": "KP046",
    "date": "2026-10-06",
    "code": "Nb",
    "session": "MORNING",
    "secondaryCode": "x",
    "value": 0.5,
    "dutyRecordId": "duty_record_id"
  }
  ```
- **Xử lý đặc biệt**:
  - Tự động hoàn lại quỹ ngày trực cũ và trừ vào quỹ ca trực mới.
  - Tự động đồng bộ `isAvailable = true/false` vào tài khoản User nếu ngày chấm là ngày hôm nay (ngoại trừ Lãnh đạo).

### 3.4. API Chấm Nhanh Hàng Loạt
- **Endpoint**: `POST /api/staff/attendance/bulk-daily`
- **Request Body**:
  ```json
  {
    "ma_khoa": "KP046",
    "date": "2026-10-31",
    "code": "x",
    "overwrite": false
  }
  ```

### 3.5. API Xem Lịch Công & Trực Cá Nhân
- **Endpoint**: `GET /api/staff/attendance/my-summary`
- **Query Params**: `monthYear` (tùy chọn).
- Tự động nhận diện tài khoản người dùng qua token đăng nhập và `user.staffId`.

### 3.6. API Xuất File Excel Chuẩn Biểu Mẫu
- **Endpoint**: `GET /api/staff/attendance/export-excel`
- **Query Params**:
  - `monthYear` (String): Ví dụ `2026-10`.
  - `type` (String): `CHAM_CONG` hoặc `CHAM_TRUC`.
  - `ma_khoa` (String): `KP046`.
- **Response**: Binary Excel Stream (`.xlsx`).

---

## 4. CẤU TRÚC DỮ LIỆU CSDL (PRISMA MODELS)

### 4.1. `StaffDutyRecord` (Bảng Chấm Trực)
- `id`: Khóa chính.
- `staffId`: Khóa ngoại trỏ đến `Staff`.
- `dutyDate`: Ngày trực (`YYYY-MM-DD`).
- `dutyCode`: Ký hiệu trực (`T`, `C`, `L`, `Te`).
- `dutyType`: Loại trực (`TRUC_CHINH` / `TRUC_KEM`).
- `allowanceDays`: Định mức nghỉ bù (`1.0` cho thường/chủ nhật, `2.0` cho lễ/tết).
- `compensatedDays`: Số ngày thực tế đã nghỉ bù (`0.0`, `0.5`, `1.0`, `1.5`, `2.0`).
- `isFullyCompensated`: Đã nghỉ bù đủ (`true`/`false`).

### 4.2. `StaffAttendanceRecord` (Bảng Chấm Công)
- `id`: Khóa chính.
- `staffId`: Khóa ngoại trỏ đến `Staff`.
- `workDate`: Ngày làm việc (`YYYY-MM-DD`).
- `code`: Ký hiệu công (`x`, `Nb`, `P`, `L`, `H`, `Ô`, `TS`, `KL`).
- `session`: Buổi làm việc (`FULL_DAY`, `MORNING`, `AFTERNOON`).
- `secondaryCode`: Ký hiệu buổi còn lại (ví dụ `x` khi nghỉ bù nửa ngày sáng `Nb/x`).
- `value`: Giá trị công (`1.0` hoặc `0.5`).
- `dutyRecordId`: Khóa ngoại liên kết ca trực khi là nghỉ bù.

### 4.3. `StaffMonthlyLock` (Khóa Sổ Tháng)
- `ma_khoa`: Mã khoa.
- `monthYear`: Tháng năm (`YYYY-MM`).
- `sheetType`: Loại bảng (`CHAM_CONG` / `CHAM_TRUC`).
- `isLocked`: Đã khóa sổ (`true`/`false`).

### 4.4. `StaffMonthlyAttendanceNote` (Ghi Chú Tháng Bảng Chấm Công)
- `id`: Khóa chính (cuid).
- `staffId`: Khóa ngoại trỏ đến `Staff`.
- `ma_khoa`: Mã khoa/phòng.
- `monthYear`: Tháng năm (`YYYY-MM`).
- `note`: Nội dung ghi chú (ví dụ: `60% 15 N...`, `Nghỉ thai sản`, `Đi học`, `Thử việc`...).
- `updatedBy`: Tên người cập nhật.

---

## 5. TÍNH NĂNG MỚI: GHI CHÚ THÁNG & BỘ LỌC TÌM KIẾM THÔNG MINH

### 5.1. Cột Ghi Chú Tháng
- **Vị trí**: Đặt tại cuối Bảng Chấm Công (sau cột *Hưởng BHXH*), cố định bên phải `fixed: right`.
- **Thao tác**: Nhấp trực tiếp vào ô `+ Ghi chú` (hoặc icon ✎) để mở Modal nhập ghi chú. Hỗ trợ phím tắt `Enter` để lưu nhanh.
- **Xuất Excel**: Ghi chú được xuất tự động vào Cột 37 (**cột `AK`**) của file Excel biểu mẫu Bảng Chấm Công bệnh viện.

### 5.2. Bộ Lọc Tìm Kiếm Viết Tắt Thông Minh (Initials Search)
- **Vị trí**: Nằm tại hàng công cụ cạnh bộ chọn Ngày và Khoa/Phòng.
- **Cơ chế khớp linh hoạt**:
  1. **Khớp họ tên trực tiếp**: Cả có dấu và không dấu (VD: `nguyễn thiện an` hoặc `nguyen thien an`).
  2. **Khớp từ viết tắt chữ cái đầu (Initials)**:
     - `Nguyễn Thiện An` $\rightarrow$ gõ `nta`
     - `Hoàng Đình Dũng` $\rightarrow$ gõ `hdd` hoặc `hđd`
     - `Lâm An Biên` $\rightarrow$ gõ `lab`
     - `Chu Hương Thảo` $\rightarrow$ gõ `cht`
     - `Trần Thị Huyền` $\rightarrow$ gõ `tth`
     - `Lê Thị Phượng` $\rightarrow$ gõ `ltp`
  3. **Khớp mã nhân viên**: `NV...`
  4. **Khớp chức vụ**: `trưởng phòng`, `phó phòng`...
- **Phạm vi tác dụng**: Tự động lọc danh sách cán bộ đồng bộ trên cả 4 Tab (*Chấm Công, Chấm Trực, Sổ Nghỉ Bù, Chấm Thêm Giờ*), có thông báo quân số lọc trực quan (VD: *Tổng quân số: 1 cán bộ (Lọc từ 8 cán bộ)*).

---

## 6. QUY TẮC HIỂN THỊ NHÂN SỰ NGHỈ VIỆC & CHUYỂN CÔNG TÁC THEO MỐC THỜI GIAN

Để đảm bảo tính chính xác về quân số và lương thời gian, hệ thống tự động xử lý hiển thị nhân sự trên Bảng Chấm Công theo mốc thời gian:

### 6.1. Quy tắc hiển thị theo mốc ngày:
1. **Chuyển công tác / nghỉ việc vào giữa tháng (Ví dụ: Ngày 15/11)**:
   - **Từ ngày 01 đến ngày 14**: Cán bộ vẫn làm việc tại khoa $\rightarrow$ **Vẫn hiển thị đầy đủ trên Bảng Chấm Công** để chấm công bình thường và tính đủ lương thời gian.
   - **Cạnh tên cán bộ**: Hiển thị nhãn cảnh báo trực quan: `(Chuyển CT từ ngày 15/11)` hoặc `(Nghỉ việc từ ngày 15/11)`.
   - **Từ ngày 15 đến cuối tháng**: Các ô hiển thị mờ với ký hiệu `✕` và tooltip giải thích (*Cán bộ đã chuyển công tác từ ngày 15/11*). Chức năng *Khởi tạo công cả tháng* hoặc *Chấm nhanh cả phòng* sẽ tự động bỏ qua từ ngày 15 trở đi.
   - **Sang tháng tiếp theo (từ 01/12 trở đi)**: Cán bộ đã chuyển đi từ tháng trước nên sẽ **tự động ẩn vĩnh viễn** khỏi Bảng Chấm Công của khoa cũ, quân số tự động cập nhật chuẩn xác.

2. **Đã nghỉ việc / chuyển công tác trước tháng đang xem**:
   - Tự động **ẨN HOÀN TOÀN** khỏi Bảng Chấm Công, Khởi tạo công cả tháng, Chấm nhanh và File Excel xuất khẩu (trừ trường hợp tháng đó trước đây đã có dữ liệu chấm công cũ thì vẫn hiển thị để lưu giữ lịch sử).

3. **Cán bộ có trạng thái Đã nghỉ việc / Thuyên chuyển nhưng không có ngày cụ thể**:
   - Nếu trong tháng không phát sinh ngày công nào $\rightarrow$ **Tự động ẨN**.

