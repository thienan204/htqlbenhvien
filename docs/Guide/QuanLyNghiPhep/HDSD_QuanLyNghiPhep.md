# HƯỚNG DẪN SỬ DỤNG & TÀI LIỆU KỸ THUẬT PHÂN HỆ QUẢN LÝ NGHỈ PHÉP
**BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN**

---

## 1. MỤC ĐÍCH & PHẠM VI (SCOPE)
Phân hệ **Quản Lý Nghỉ Phép** được xây dựng thành một **Module hoàn toàn độc lập (Isolated Module)** tại đường dẫn `/staff/leave-management`.
Phân hệ này giải quyết trọn vẹn luồng nghiệp vụ thực tế giữa Khoa/Phòng, Phòng Tổ chức Cán bộ (TCCB) và Ban Giám Đốc Bệnh viện:
1. **2 Mẫu Đơn Chuẩn**:
   - **Mẫu 1 (Nhân viên & Phó Trưởng khoa/phòng)**: Có mục bàn giao công việc / trực chuyên môn cho đồng nghiệp cùng khoa.
   - **Mẫu 2 (Trưởng Khoa / Trưởng Phòng)**: Có mục phân công, ủy quyền đồng chí Phó Trưởng phòng/khoa phụ trách, điều hành toàn diện hoạt động của đơn vị trong thời gian vắng mặt.
2. **Quyền hạn của Phòng TCCB**:
   - Tra cứu quỹ phép năm của cán bộ.
   - **Được quyền chỉnh sửa số ngày thực tế cho phép nghỉ** (ví dụ: xin 5 ngày nhưng quỹ còn ít hoặc khoa thiếu người trực nên TCCB điều chỉnh duyệt 3 ngày).
   - **Sinh & In Phiếu Kết Quả Nghỉ Phép (A4)** trình Giám đốc Bệnh viện ký văn bản giấy.
3. **Quy tắc Hạn chốt 30/03 & Chi trả tiền phép**:
   - Hạn chốt sử dụng phép năm trước mặc định là ngày **30/03 năm kế tiếp** (có thể cấu hình).
   - Nếu cán bộ không làm đơn xin nghỉ hết trước 30/03: Hệ thống tự động khóa và tính là **"Cống hiến"** cho bệnh viện.
   - Nếu cán bộ có làm đơn nhưng bị Lãnh đạo từ chối do **"Thiếu nhân lực / Yêu cầu công tác"**: Hệ thống đưa vào danh sách đề xuất **Ban Giám đốc phê duyệt chi trả tiền không nghỉ phép**.
4. **Tự động đồng bộ một chiều sang Bảng Chấm Công**:
   - Sau khi Lãnh đạo Bệnh viện ký văn bản giấy và TCCB bấm *"Xác nhận đã ký"*: Hệ thống tự động trừ quỹ ngày phép và điền mã `P` (cả ngày) hoặc `P/2` (buổi Sáng / Chiều) vào đúng ngày trên Bảng Chấm Công (`StaffAttendanceRecord`).

---

## 2. KIẾN TRÚC CƠ SỞ DỮ LIỆU (DATABASE SCHEMA)

### 2.1. Bảng `StaffLeaveBalance` (Quỹ phép năm của Cán bộ)
| Tên trường | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `id` | String (CUID) | Khóa chính |
| `staffId` | String | Mã định danh cán bộ (liên kết `Staff`) |
| `year` | Int | Năm quản lý phép (VD: 2026) |
| `standardDays` | Float | Số ngày tiêu chuẩn (12 ngày hoặc 14 ngày độc hại) |
| `seniorityDays` | Float | Thâm niên công tác (Cứ mỗi 5 năm làm việc + 1 ngày phép) |
| `transferredDays` | Float | Số ngày chuyển từ năm trước sang |
| `totalAvailable` | Float | Tổng số ngày phép được nghỉ trong năm |
| `usedDays` | Float | Số ngày đã nghỉ |
| `remainingDays` | Float | Số ngày phép còn lại |
| `expiredDays` | Float | Số ngày hết hạn sau ngày 30/03 (tính cống hiến) |
| `compensatedCashDays` | Float | Số ngày được Ban Giám đốc duyệt chi trả tiền do thiếu nhân lực |
| `compensatedCashAmount` | Float | Tổng số tiền đã thanh toán (VNĐ) |

### 2.2. Bảng `StaffLeaveRequest` (Đơn xin nghỉ phép)
| Tên trường | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `id` | String (CUID) | Khóa chính |
| `formType` | String | `STAFF_DEPUTY` (Mẫu 1) hoặc `DEPARTMENT_HEAD` (Mẫu 2) |
| `staffId` | String | Cán bộ làm đơn |
| `ma_khoa` | String | Khoa/Phòng công tác |
| `requestedStartDate` | String | Ngày bắt đầu xin nghỉ (YYYY-MM-DD) |
| `requestedEndDate` | String | Ngày kết thúc xin nghỉ (YYYY-MM-DD) |
| `requestedDays` | Float | Số ngày xin nghỉ ban đầu |
| `session` | String | `FULL_DAY` (Cả ngày) \| `MORNING` (Sáng) \| `AFTERNOON` (Chiều) |
| `reason` | String | Lý do xin nghỉ phép |
| `handoverStaffId` | String? | Cán bộ nhận bàn giao công việc (Mẫu 1) |
| `actingHeadStaffId` | String? | Phó phòng phụ trách điều hành thay (Mẫu 2) |
| `approvedDays` | Float? | **Số ngày TCCB và Lãnh đạo thực tế cho phép nghỉ** |
| `approvedStartDate` | String? | Ngày bắt đầu duyệt nghỉ thực tế |
| `approvedEndDate` | String? | Ngày kết thúc duyệt nghỉ thực tế |
| `tccbNote` | String? | Ý kiến / lý do điều chỉnh của Phòng TCCB |
| `status` | String | `PENDING_DEPT` → `PENDING_TCCB` → `PENDING_DIRECTOR` → `APPROVED` / `REJECTED` |
| `rejectReasonType` | String? | `THIEU_NHAN_LUC` (Đề xuất trả tiền) \| `LY_DO_KHAC` |
| `isEligibleForCashPayout`| Boolean | Đánh dấu đủ điều kiện xem xét thanh toán tiền |
| `directorSignatureStatus`| String | `CHUA_KY` \| `DA_KY` |
| `directorSignerName` | String? | Tên Lãnh đạo ký văn bản giấy |
| `directorPaperCode` | String? | Số hiệu phiếu kết quả đã ký (VD: 15/PB-TCCB) |

---

## 3. DANH SÁCH API ROUTES ĐỘC LẬP

### 1. `GET /api/staff/leave-management/balance`
- **Mục đích**: Lấy thông tin hạn mức phép năm của cán bộ.
- **Query Params**: `staffId` (tùy chọn), `year` (mặc định năm hiện tại).
- **Response**: Trả về `staff` và `balance`. Nếu chưa có bản ghi năm đó, hệ thống tự động khởi tạo dựa trên ngày tuyển dụng và khoa công tác.

### 2. `GET /api/staff/leave-management`
- **Mục đích**: Tra cứu danh sách đơn xin nghỉ phép.
- **Query Params**: `view` (`MY_REQUESTS` | `DEPT_REQUESTS` | `ALL_TCCB`), `status`, `year`, `ma_khoa`.

### 3. `POST /api/staff/leave-management`
- **Mục đích**: Tạo mới đơn xin nghỉ phép.
- **Body**:
  ```json
  {
    "staffId": "...",
    "formType": "STAFF_DEPUTY", // hoặc DEPARTMENT_HEAD
    "requestedStartDate": "2026-11-10",
    "requestedEndDate": "2026-11-12",
    "requestedDays": 3.0,
    "session": "FULL_DAY",
    "reason": "Giải quyết việc gia đình",
    "destination": "Lạng Sơn",
    "contactPhone": "0912345678",
    "handoverStaffId": "staff_id_123"
  }
  ```

### 4. `PUT /api/staff/leave-management/review`
- **Mục đích**: Trưởng khoa duyệt cấp 1 hoặc Phòng TCCB thẩm tra và sửa số ngày được nghỉ.
- **Body (TCCB thẩm tra & sửa số ngày)**:
  ```json
  {
    "requestId": "...",
    "action": "TCCB_REVIEW",
    "approvedDays": 2.0,
    "approvedStartDate": "2026-11-10",
    "approvedEndDate": "2026-11-11",
    "tccbNote": "Chỉ duyệt 2 ngày do khoa thiếu người trực cấp cứu"
  }
  ```

### 5. `PUT /api/staff/leave-management/confirm-signed`
- **Mục đích**: Xác nhận sau khi Lãnh đạo Bệnh viện đã ký văn bản giấy.
- **Tác vụ tự động**:
  1. Đổi trạng thái sang `APPROVED`, `directorSignatureStatus = 'DA_KY'`.
  2. Trừ đúng số ngày `approvedDays` vào Quỹ ngày phép năm trong `StaffLeaveBalance`.
  3. Ghi nhận mã `P` hoặc `P/2` vào Bảng Chấm Công (`StaffAttendanceRecord`).

### 6. `GET / POST /api/staff/leave-management/config`
- **Mục đích**: Đọc và lưu cấu hình hạn chốt 30/03 và trích xuất danh sách cán bộ bị từ chối do thiếu nhân lực.

---

## 4. HƯỚNG DẪN THAO TÁC NGƯỜI DÙNG (USER GUIDE)

### Bước 1: Nhân viên hoặc Trưởng khoa làm đơn
1. Vào phân hệ Chấm công hoặc truy cập `/staff/leave-management`.
2. Bấm nút **`+ Tạo Đơn Xin Nghỉ Phép`**.
3. Hệ thống tự nhận diện chức vụ:
   - Nếu là **Trưởng khoa/phòng**: Tự động mở **Mẫu 2** -> Chọn đồng chí Phó Trưởng khoa phụ trách điều hành thay.
   - Nếu là **Nhân viên / Phó phòng**: Mở **Mẫu 1** -> Chọn đồng chí nhận bàn giao việc trong khoa.
4. Chọn hình thức: Cả ngày (8h) hoặc Buổi Sáng (4h) hoặc Buổi Chiều (4h), chọn ngày và nhập lý do. Bấm **Gửi Đơn**.

### Bước 2: Trưởng khoa duyệt ý kiến (với đơn Mẫu 1)
1. Trưởng khoa vào Tab **"2. Duyệt Đơn Khoa/Phòng"**.
2. Kiểm tra quân số và ca trực của khoa.
3. Bấm **Duyệt Đơn** để chuyển lên Phòng TCCB. (Nếu không cho nghỉ do thiếu người thì từ chối kèm lý do).

### Bước 3: Phòng TCCB tra cứu, thẩm tra & Sửa số ngày được nghỉ
1. Cán bộ TCCB vào Tab **"3. Phòng TCCB Thẩm Tra & In Phiếu"**.
2. Bấm **Thẩm Tra** trên đơn cần xử lý.
3. Kiểm tra số ngày phép còn lại. TCCB **có thể sửa lại số ngày cho phép nghỉ** (ví dụ: xin 5 ngày, TCCB sửa duyệt 3 ngày).
4. Bấm **Lưu & Sẵn Sàng Trình Ký**.

### Bước 4: In Phiếu Kết Quả trình Giám Đốc Bệnh Viện ký
1. Tại đơn đã thẩm tra, bấm nút **`🖨️ In Mẫu Phiếu Kết Quả`**.
2. Hệ thống hiển thị bản in A4 chuẩn hành chính Bệnh viện ĐK tỉnh Lạng Sơn gồm: Tiêu ngữ, số ngày được duyệt, thời gian nghỉ và phần ký 3 bên.
3. In ra giấy và đem trình Giám đốc Bệnh viện ký, đóng dấu.

### Bước 5: Xác nhận Lãnh đạo đã ký -> Tự động điền công
1. Sau khi Lãnh đạo Bệnh viện ký tay vào phiếu giấy, TCCB vào lại đơn trên phần mềm và bấm **`Xác Nhận Đã Ký`**.
2. Nhập Người ký (Giám đốc BV), Số hiệu phiếu giấy (VD: 15/PB-TCCB) và bấm **Xác Nhận**.
3. Hệ thống tự động:
   - Trừ số ngày được duyệt vào Quỹ phép năm của cán bộ.
   - Tự động điền các ô công `P` (hoặc `P/2`) trên Bảng Chấm Công của khoa.

---

### Bước 6: Quản lý Quỹ Phép Năm & Đối Soát Bảng Chấm Công (Tab 4)
Dành cho Phòng TCCB và Lãnh đạo để theo dõi, điều chỉnh số ngày phép theo từng năm (2026, 2027...):
1. **Chuyển đổi Năm Quản Lý**: Chọn năm mong muốn (Ví dụ: 2026 hoặc 2027) để xem toàn bộ quỹ phép.
2. **Đồng Bộ Tự Động từ Bảng Chấm Công**:
   - Bấm nút **`🔄 Đồng Bộ Từ Bảng Chấm Công`**.
   - Hệ thống tự động quét toàn bộ 12 tháng của năm trên Bảng Chấm Công:
     + Mã `P` (Nghỉ phép cả ngày) = 1.0 ngày
     + Mã `P/2` (Phép buổi Sáng / Chiều) = 0.5 ngày
   - Hệ thống tự động cộng dồn thành **Số ngày đã nghỉ thực tế** và tính lại **Số ngày phép còn lại** cho toàn bộ nhân sự bệnh viện.
3. **Điều chỉnh Thủ Công cho từng cá nhân**:
   - Bấm nút **`✏️ Sửa`** tại dòng cán bộ tương ứng.
   - Cho phép nhập trực tiếp: *Số ngày đã nghỉ*, *Số ngày còn lại*, *Số ngày chuyển sang từ năm trước*, hoặc *Ghi chú*.
   - Hệ thống sẽ lưu giữ số liệu chuẩn theo hồ sơ thực tế.
4. **Xuất File Excel**: Bấm **`Xuất Excel`** để tải về báo cáo tổng hợp quỹ phép năm của toàn viện hoặc theo từng khoa/phòng.


