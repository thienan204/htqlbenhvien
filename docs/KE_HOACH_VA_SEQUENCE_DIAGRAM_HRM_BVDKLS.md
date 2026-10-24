# 👥 TÀI LIỆU THIẾT KẾ KIẾN TRÚC & KẾ HOẠCH PHÁT TRIỂN PHÂN HỆ QUẢN TRỊ NHÂN SỰ (HRM)
### Bệnh viện Đa khoa Lạng Sơn (Quy mô 1.500 Cán bộ Nhân viên)

---

## 📌 MỤC LỤC
1. [Đánh giá Năng lực Hệ thống & Hiện trạng Có sẵn](#1-đánh-giá-năng-lực-hệ-thống--hiện-trạng-có-sẵn)
2. [Sequence Diagrams Chi tiết Các Quy trình Nghiệp vụ Cốt lõi](#2-sequence-diagrams-chi-tiết-các-quy-trình-nghiệp-vụ-cốt-lõi)
   - [2.1. Quy trình Quản lý Phạm vi Hành nghề & Phân quyền Kỹ thuật Lâm sàng (Chống xuất toán BHYT)](#21-quy-trình-quản-lý-phạm-vi-hành-nghề--phân-quyền-kỹ-thuật-lâm-sàng-chống-xuất-toán-bhyt)
   - [2.2. Quy trình Nộp & Phê duyệt Đơn Nghỉ phép Trực tuyến (Leave Management)](#22-quy-trình-nộp--phê-duyệt-đơn-nghỉ-phép-trực-tuyến-leave-management)
   - [2.3. Quy trình Đào tạo Y khoa liên tục (CME) & Bồi dưỡng Chuyên môn](#23-quy-trình-đào-tạo-y-khoa-liên-tục-cme--bồi-dưỡng-chuyên-môn)
   - [2.4. Quy trình Chấm công Phân ca Lâm sàng & Kíp trực 24/24](#24-quy-trình-chấm-công-phân-ca-lâm-sàng--kíp-trực-2424)
   - [2.5. Quy trình Tính Lương Ngạch bậc & Phụ cấp Phẫu thuật - Thủ thuật (QĐ 73/2011)](#25-quy-trình-tính-lương-ngạch-bậc--phụ-cấp-phẫu-thuật---thủ-thuật-qđ-732011)
3. [Kế hoạch Phát triển Riêng cho Từng Module (Individual Roadmap)](#3-kế-hoạch-phát-triển-riêng-cho-từng-module-individual-roadmap)
   - [Module 1: Hồ sơ Nhân sự 360° & Hợp đồng Lao động (`HR-PROFILE`)](#module-1-hồ-sơ-nhân-sự-360-v-hợp-đồng-lao-động-hr-profile)
   - [Module 2: Quản lý Phạm vi Hành nghề & Phân quyền Kỹ thuật (`HR-PRIVILEGES`)](#module-2-quản-lý-phạm-vi-hành-nghề--phân-quyền-kỹ-thuật-hr-privileges)
   - [Module 3: Đào tạo Y khoa Liên tục CME & Sau đại học (`HR-TRAINING`)](#module-3-đào-tạo-y-khoa-liên-tục-cme--sau-đại-học-hr-training)
   - [Module 4: Quản lý Chấm công & Phân ca kíp Y tế (`HR-ATTENDANCE`)](#module-4-quản-lý-chấm-công--phân-ca-kíp-y-tế-hr-attendance)
   - [Module 5: Quản lý Nghỉ phép Trực tuyến (`HR-LEAVE`)](#module-5-quản-lý-nghỉ-phép-trực-tuyến-hr-leave)
   - [Module 6: Tiền lương & Thu nhập Tăng thêm Ngành Y (`HR-PAYROLL`)](#module-6-tiền-lương--thu-nhập-tăng-thêm-ngành-y-hr-payroll)
4. [Nguyên tắc An toàn Mã nguồn & CSDL (Tuân thủ .cursorrules)](#4-nguyên-tắc-an-toàn-mã-nguồn--csdl-tuân-thủ-cursorrules)

---

## 1. ĐÁNH GIÁ NĂNG LỰC HỆ THỐNG & HIỆN TRẠNG CÓ SẴN

### 1.1. Khả năng chịu tải cho 1.500 nhân sự
- **Cơ sở dữ liệu PostgreSQL**: Hoàn toàn đáp ứng quy mô này với tốc độ phản hồi tính bằng mili-giây. Dữ liệu chấm công hàng tháng (~45.000 dòng/tháng) và dữ liệu lương (~1.500 dòng/tháng) hoàn toàn xử lý tức thì khi có Index.
- **Next.js App Router + Prisma ORM + Ant Design**: Hỗ trợ phân trang máy chủ (Server-side Pagination), xuất báo cáo ExcelJS hàng chục nghìn dòng không nghẽn bộ nhớ.

### 1.2. Nền tảng sẵn có trong Codebase
- Bảng `Staff`: Đã có thông tin hành chính, CCCD, BHYT, BHXH, ngạch lương, bậc lương, hệ số lương.
- Bảng `Department`: Quản lý 100% cơ cấu khoa/phòng bệnh viện.
- Bảng `PracticingCertificate`: Quản lý số chứng chỉ hành nghề y tế.
- Bảng `ScopeOfPracticeCatalog` (`/pham-vi-chuyen-mon`): Danh mục phạm vi chuyên môn & Map dịch vụ kỹ thuật Mẫu 05 BHYT.
- Bảng `DutyRoster` (`/clinical-scheduling`): Bảng xếp ca trực lâm sàng.
- Bảng `User`: Liên kết trực tiếp `staffId` để nhân viên đăng nhập bằng tài khoản cá nhân.

---

## 2. SEQUENCE DIAGRAMS CHI TIẾT CÁC QUY TRÌNH NGHIỆP VỤ CỐT LÕI

### 2.1. Quy trình Quản lý Phạm vi Hành nghề & Phân quyền Kỹ thuật Lâm sàng (Chống xuất toán BHYT)

```mermaid
sequenceDiagram
    autonumber
    actor BS as Bác sĩ Lâm sàng
    actor TCCB as Phòng Tổ chức Cán bộ / KHTH
    actor GiamDoc as Ban Giám đốc Bệnh viện
    participant UI as Giao diện Phân quyền Kỹ thuật (/hr/clinical-privileges)
    participant API as API Scope & Privileges
    participant DB as PostgreSQL (Staff, Privilege, Service)
    participant XMLChecker as Module Giám định BHYT & Check XML

    TCCB->>UI: Lập danh sách đề xuất phân quyền kỹ thuật cho Bác sĩ BS
    UI->>DB: Tải danh mục kỹ thuật Mẫu 05 BHYT & Lịch sử đào tạo CME của BS
    DB-->>UI: Hiển thị các gói kỹ thuật đã hoàn thành
    TCCB->>UI: Phân quyền mức độ: [Độc lập thực hiện] hoặc [Có giám sát]
    TCCB->>GiamDoc: Trình Hội đồng chuyên môn & Giám đốc ký Quyết định phê duyệt
    GiamDoc->>UI: Phê duyệt online & Ban hành Quyết định
    UI->>API: POST /api/hr/privileges/approve
    API->>DB: Lưu bảng StaffClinicalPrivilege (status = APPROVED, validFrom, validTo)
    DB-->>API: Lưu thành công
    API-->>UI: Cập nhật phạm vi hành nghề của Bác sĩ thành công

    Note over BS, XMLChecker: Khi Bác sĩ chỉ định hoặc thực hiện kỹ thuật trên bệnh nhân
    BS->>XMLChecker: Đứng tên Phẫu thuật viên/Chỉ định dịch vụ kỹ thuật trong XML3
    XMLChecker->>DB: Kiểm tra chéo: Mã Bác sĩ + Mã Dịch vụ kỹ thuật
    alt Bác sĩ nằm ngoài danh mục được Giám đốc phê duyệt
        DB-->>XMLChecker: Không tìm thấy phân quyền hợp lệ!
        XMLChecker-->>BS: ⚠️ CẢNH BÁO ĐỎ: Bác sĩ chưa được phê duyệt kỹ thuật này (Nguy cơ xuất toán BHYT 100%)
    else Đã được phê duyệt hợp lệ
        DB-->>XMLChecker: Phân quyền hợp lệ (Độc lập thực hiện)
        XMLChecker-->>BS: ✅ Hồ sơ hợp lệ, sẵn sàng gửi cổng Giám định BHYT
    end
```

---

### 2.2. Quy trình Nộp & Phê duyệt Đơn Nghỉ phép Trực tuyến (Leave Management)

```mermaid
sequenceDiagram
    autonumber
    actor NV as Nhân viên Y tế
    actor TruongKhoa as Trưởng Khoa / Điều dưỡng Trưởng
    actor TCCB as Phòng Tổ chức Cán bộ
    participant UI as Ứng dụng Nhân sự (/hr/leaves)
    participant API as API Nghỉ phép (/api/hr/leaves)
    participant DB as PostgreSQL (StaffLeave, LeaveBalance)
    participant Timekeeping as Bảng Chấm công Tháng

    NV->>UI: Mở form xin nghỉ phép (Chọn loại phép: Phép năm, Thai sản, Nghỉ ốm...)
    UI->>API: GET /api/hr/leaves/balance?staffId=...
    API->>DB: Kiểm tra số ngày phép còn lại trong quỹ phép năm
    DB-->>API: Trả về: Còn 8/14 ngày phép
    API-->>UI: Hiển thị quỹ phép còn lại
    NV->>UI: Chọn ngày nghỉ (Từ ngày - Đến ngày) & Nhập lý do, người bàn giao công việc
    NV->>UI: Bấm "Nộp đơn nghỉ phép"
    UI->>API: POST /api/hr/leaves
    API->>DB: Tạo bản ghi StaffLeave (Status = PENDING_DEPARTMENT)
    DB-->>API: Lưu thành công
    API-->>UI: Nộp đơn thành công

    Note over TruongKhoa, TCCB: Trưởng Khoa duyệt cấp 1
    TruongKhoa->>UI: Xem danh sách đơn nghỉ phép chờ duyệt của khoa
    TruongKhoa->>UI: Bấm "Duyệt đơn"
    UI->>API: PUT /api/hr/leaves/[id]/approve-dept
    API->>DB: Cập nhật status = PENDING_HR

    Note over TCCB, Timekeeping: Phòng TCCB duyệt cấp cuối
    TCCB->>UI: Phòng TCCB xác nhận duyệt chính thức
    UI->>API: PUT /api/hr/leaves/[id]/approve-hr
    API->>DB: Cập nhật status = APPROVED, Trừ quỹ phép năm trong LeaveBalance
    API->>Timekeeping: Tự động ghi nhận ký hiệu "P" (Nghỉ phép) vào ngày đó trên Bảng chấm công
    API-->>UI: Hoàn tất phê duyệt
    UI-->>NV: Nhận thông báo: Đơn nghỉ phép đã được duyệt thành công!
```

---

### 2.3. Quy trình Đào tạo Y khoa liên tục (CME) & Bồi dưỡng Chuyên môn

```mermaid
sequenceDiagram
    autonumber
    actor BS as Bác sĩ / Điều dưỡng
    actor TCCB as Phòng TCCB / Trung tâm Đào tạo
    participant UI as Quản lý Đào tạo (/hr/cme)
    participant API as API CME (/api/hr/cme)
    participant DB as PostgreSQL (CmeCourse, StaffCmeProgress)

    BS->>UI: Tải lên chứng chỉ CME vừa hoàn thành (Ảnh chụp/PDF, Số tiết đào tạo, Đơn vị cấp)
    UI->>API: POST /api/hr/cme/submit
    API->>DB: Lưu bản ghi CmeRecord (Status = PENDING)
    DB-->>API: Lưu thành công
    API-->>UI: Thông báo nộp chứng chỉ thành công

    TCCB->>UI: Xem danh sách chứng chỉ chờ thẩm tra
    TCCB->>UI: Đối chiếu mã chứng chỉ & Bấm "Duyệt hợp lệ"
    UI->>API: PUT /api/hr/cme/[id]/verify
    API->>DB: Cập nhật Status = VERIFIED, Cộng dồn số tiết vào bảng StaffCmeProgress
    DB-->>API: Cập nhật thành công
    
    Note over BS, DB: Hệ thống tự động tính lũy kế giờ tín chỉ CME
    UI->>API: GET /api/hr/cme/my-status
    API->>DB: Tính tổng: Đã đạt 36/48 giờ tín chỉ quy định
    DB-->>UI: Trả về thanh tiến độ đạt 75%
    UI-->>BS: Hiển thị: Còn thiếu 12 giờ CME trong chu kỳ 2 năm để duy trì CCHN
```

---

### 2.4. Quy trình Chấm công Phân ca Lâm sàng & Kíp trực 24/24

```mermaid
sequenceDiagram
    autonumber
    actor NV as Nhân viên Y tế
    actor MayChamCong as Máy Vân tay / Khuôn mặt / Web QR
    actor TruongKhoa as Điều dưỡng trưởng Khoa
    participant UI as Bảng Chấm công (/hr/attendance)
    participant API as API Chấm công (/api/hr/attendance)
    participant DB as PostgreSQL (DailyAttendance, MonthlyTimesheet)

    NV->>MayChamCong: Quẹt vân tay / Nhận diện khuôn mặt ca vào/ra
    MayChamCong->>API: POST /api/hr/attendance/sync (Thời gian, Mã NV, DeviceId)
    API->>DB: Lưu bản ghi quẹt công gốc (RawLog)
    
    Note over API, DB: Động cơ xử lý đối chiếu với Lịch trực lâm sàng (DutyRoster)
    API->>DB: So sánh giờ vào/ra với Ca làm việc (Ca hành chính, Ca đêm, Trực 24h)
    API->>DB: Ghi nhận kết quả chấm công ngày (Đúng giờ, Đi muộn, Về sớm, Tăng ca)
    
    TruongKhoa->>UI: Cuối tháng mở Bảng chấm công tổng hợp của Khoa
    UI->>API: GET /api/hr/attendance/monthly?ma_khoa=K01&month=10
    API->>DB: Tính toán tổng ngày công: Công hành chính (X), Trực (T), Phép (P), Ốm (Ô)
    DB-->>UI: Trả về Bảng chấm công dạng lưới Matrix 1-31 ngày
    TruongKhoa->>UI: Xác nhận và ký duyệt bảng công khoa phòng chuyển Phòng TCCB
```

---

### 2.5. Quy trình Tính Lương Ngạch bậc & Phụ cấp Phẫu thuật - Thủ thuật (QĐ 73/2011)

```mermaid
sequenceDiagram
    autonumber
    actor KTT as Kế toán Tiền lương / Phòng TCKT
    participant UI as Giao diện Tính lương (/hr/payroll)
    participant Engine as Động cơ Tính lương (PayrollCalculator)
    participant DB as PostgreSQL (Staff, Ngạch bậc, Chấm công)
    participant XMLDB as Dữ liệu Ca mổ (XML3 / PTTT)
    participant BankExport as Bộ xuất file Ngân hàng & Phiếu lương

    KTT->>UI: Chọn tháng tính lương (ví dụ: Tháng 10/2026)
    KTT->>UI: Bấm "Khởi tạo bảng lương tháng"
    UI->>Engine: Kích hoạt tiến trình tính toán lương cho 1.500 nhân sự
    
    par 1. Đọc dữ liệu Công chuẩn
        Engine->>DB: Lấy tổng số ngày công làm việc từ Bảng chấm công tháng
    and 2. Tính Lương Ngạch bậc
        Engine->>DB: Lấy Hệ số lương × Mức lương cơ sở (2.340.000đ)
    and 3. Tính Phụ cấp Ưu đãi nghề
        Engine->>DB: Tỷ lệ ưu đãi nghề (20%, 40%, 70%, 100% theo vị trí)
    and 4. Tính Phụ cấp Ca mổ (QĐ 73/2011/QĐ-TTg)
        Engine->>XMLDB: Tổng hợp số ca phẫu thuật/thủ thuật loại ĐB, 1, 2, 3 đứng tên KTV
        XMLDB-->>Engine: Trả về số tiền phụ cấp mổ tương ứng từng Bác sĩ/KTV
    and 5. Khấu trừ Pháp định
        Engine->>Engine: Khấu trừ BHXH (8%), BHYT (1.5%), BHTN (1%), Thuế TNCN
    end

    Engine->>DB: Lưu chi tiết bảng lương 1.500 nhân viên vào StaffSalaryDetail
    DB-->>UI: Hoàn tất tính toán bảng lương tháng
    UI-->>KTT: Hiển thị bảng tổng hợp lương toàn viện, cho phép điều chỉnh
    KTT->>UI: Bấm "Chốt bảng lương & Phát hành phiếu lương"
    UI->>BankExport: Xuất file chuyển khoản ngân hàng (Vietcombank/BIDV)
    UI->>DB: Bật trạng thái xem Phiếu lương điện tử cho từng tài khoản nhân viên
```

---

## 3. KẾ HOẠCH PHÁT TRIỂN RIÊNG CHO TỪNG MODULE (INDIVIDUAL ROADMAP)

### Module 1: Hồ sơ Nhân sự 360° & Hợp đồng Lao động (`HR-PROFILE`)
- **Mục tiêu**: Quản lý tập trung toàn diện 1.500 hồ sơ cán bộ nhân viên, quá trình công tác, hợp đồng lao động và theo dõi kỳ nâng bậc lương thường xuyên.
- **Dữ liệu Database (Prisma Models mới)**:
  - `StaffContract`: Quản lý hợp đồng (loại HĐ, ngày ký, ngày hết hạn, tệp scan PDF đính kèm).
  - `StaffFamilyMember`: Người phụ thuộc giảm trừ gia cảnh thuế TNCN.
  - `StaffWorkHistory`: Quá trình công tác, điều động, bổ nhiệm chức vụ.
  - Bổ sung trường optional vào `Staff`: `email`, `so_bhxh_so`, `avatar_url`.
- **API Endpoints**:
  - `GET/POST /api/hr/contracts`: Quản lý hợp đồng & tự động lọc hợp đồng sắp hết hạn (30 - 60 ngày).
  - `GET/POST /api/hr/salary-steps`: Lọc danh sách nhân viên đến hạn xét nâng lương thường xuyên.
- **Màn hình UI**:
  - `src/app/hr/staff/[id]`: Màn hình Hồ sơ 360° với Tabs `type="card"` trực quan.
- **Thời gian thực hiện**: Tuần 1 - Tuần 2.

---

### Module 2: Quản lý Phạm vi Hành nghề & Phân quyền Kỹ thuật (`HR-PRIVILEGES`)
- **Mục tiêu**: Phê duyệt danh mục kỹ thuật cho từng bác sĩ/điều dưỡng (thực hiện độc lập hay có giám sát), liên thông kiểm tra chéo với module Check XML BHYT để chống xuất toán.
- **Dữ liệu Database (Prisma Models mới)**:
  - `ClinicalPrivilegeDecision`: Quyết định phê duyệt danh mục kỹ thuật của Giám đốc (Số QĐ, ngày ban hành).
  - `StaffClinicalPrivilege`: Bảng phân quyền chi tiết (`staffId`, `ma_dich_vu`, `muc_do`: INDEPENDENT / SUPERVISED).
- **API Endpoints**:
  - `GET/POST /api/hr/privileges`: Lập và phê duyệt bảng phân quyền kỹ thuật.
  - `GET /api/hr/privileges/check-compliance`: API đối soát tức thì giữa Bác sĩ chỉ định trong XML3 và danh mục kỹ thuật được duyệt.
- **Màn hình UI**:
  - `src/app/hr/privileges`: Bảng ma trận phân quyền kỹ thuật dạng cây (Tree Table) theo phân nhóm chuyên khoa.
- **Thời gian thực hiện**: Tuần 2 - Tuần 3.

---

### Module 3: Đào tạo Y khoa Liên tục CME & Sau đại học (`HR-TRAINING`)
- **Mục tiêu**: Quản lý các khóa học, chứng chỉ CME bắt buộc hàng năm để duy trì chứng chỉ hành nghề, cảnh báo nhân viên chưa đủ giờ tín chỉ theo quy định Bộ Y tế.
- **Dữ liệu Database (Prisma Models mới)**:
  - `CmeCourse`: Khóa đào tạo (Tên khóa, đơn vị đào tạo, số giờ/tín chỉ CME, ngày hoàn thành).
  - Mở rộng `StaffTraining` có sẵn: Lưu số chứng chỉ, nơi cấp, đính kèm file ảnh chứng chỉ.
- **API Endpoints**:
  - `GET /api/hr/cme/summary`: Thống kê tổng số giờ tích lũy của từng nhân viên.
  - Cảnh báo tự động danh sách bác sĩ/điều dưỡng chưa hoàn thành chỉ tiêu giờ CME trong năm.
- **Màn hình UI**:
  - `src/app/hr/cme`: Dashboard hiển thị thanh tiến độ tích lũy tín chỉ CME cá nhân.
- **Thời gian thực hiện**: Tuần 3 - Tuần 4.

---

### Module 4: Quản lý Chấm công & Phân ca kíp Y tế (`HR-ATTENDANCE`)
- **Mục tiêu**: Chấm công tự động cho 1.500 nhân sự; hỗ trợ phân ca trực đặc thù 24/24, trực thường trú và ca kíp cấp cứu.
- **Dữ liệu Database (Prisma Models mới)**:
  - `AttendanceShift`: Danh mục ca làm việc (Hành chính, Ca ngày, Ca đêm, Trực 24h).
  - `StaffDailyAttendance`: Bản ghi chấm công ngày (`staffId`, `date`, `checkIn`, `checkOut`, `shiftId`, `status`).
  - `MonthlyTimesheet`: Bảng tổng hợp công tháng tự động tính tổng công làm việc.
- **API Endpoints**:
  - `POST /api/hr/attendance/sync`: Đồng bộ dữ liệu quẹt công từ máy chấm công vân tay / khuôn mặt.
  - `GET /api/hr/attendance/monthly`: Trả về bảng tổng hợp công toàn viện.
- **Màn hình UI**:
  - `src/app/hr/attendance`: Bảng chấm công dạng lưới Matrix 1-31 ngày trực quan.
- **Thời gian thực hiện**: Tuần 4 - Tuần 5.

---

### Module 5: Quản lý Nghỉ phép Trực tuyến (`HR-LEAVE`)
- **Mục tiêu**: Số hóa 100% quy trình xin nghỉ phép, tự động trừ quỹ phép năm và cập nhật trực tiếp vào bảng chấm công tháng.
- **Dữ liệu Database (Prisma Models mới)**:
  - `StaffLeave`: Đơn nghỉ phép (`staffId`, `leaveType`, `fromDate`, `toDate`, `daysCount`, `status`, `approverId`).
  - `LeaveBalance`: Quỹ phép năm (Phép tiêu chuẩn 12-16 ngày, phép thâm niên, phép đã nghỉ, phép còn lại).
- **API Endpoints**:
  - `POST /api/hr/leaves`: Tạo đơn xin nghỉ phép.
  - `PUT /api/hr/leaves/[id]/approve`: Phê duyệt đơn đa cấp (Trưởng khoa ➔ Phòng TCCB).
- **Màn hình UI**:
  - `src/app/hr/leaves`: Màn hình nộp đơn cá nhân và màn hình duyệt đơn cho Lãnh đạo khoa/phòng.
- **Thời gian thực hiện**: Tuần 5 - Tuần 6.

---

### Module 6: Tiền lương & Thu nhập Tăng thêm Ngành Y (`HR-PAYROLL`)
- **Mục tiêu**: Tính toán bảng thanh toán tiền lương 1.500 nhân sự minh bạch, chính xác từng khoản phụ cấp phẫu thuật/thủ thuật theo QĐ 73 và xuất phiếu lương điện tử bảo mật.
- **Dữ liệu Database (Prisma Models mới)**:
  - `PayrollPeriod`: Kỳ lương tháng (Tháng/Năm, mức lương cơ sở, trạng thái chốt bảng lương).
  - `StaffSalaryDetail`: Bảng chi tiết lương từng nhân sự (Lương ngạch bậc, phụ cấp ưu đãi nghề, phụ cấp PTTT theo QĐ 73, tiền trực, giảm trừ gia cảnh, thực lĩnh).
- **API Endpoints**:
  - `POST /api/hr/payroll/calculate`: Kích hoạt động cơ tính lương tự động cho toàn viện.
  - `GET /api/hr/payroll/my-payslip`: Nhân viên tự tra cứu phiếu lương bảo mật của mình trên di động/máy tính.
- **Màn hình UI**:
  - `src/app/hr/payroll`: Bảng tổng hợp lương toàn viện cho Phòng TCKT xuất file Excel ngân hàng.
- **Thời gian thực hiện**: Tuần 6 - Tuần 7.

---

## 4. NGUYÊN TẮC AN TOÀN MÃ NGUỒN & CSDL (TUÂN THỦ .CURSORRULES)
1. **Zero Regression & Isolation**: Toàn bộ mã nguồn mới của phân hệ HR được đặt trong thư mục độc lập `src/app/hr/...` và `src/app/api/hr/...`, hoàn toàn không chạm vào các chức năng khám chữa bệnh và BHYT hiện tại.
2. **An toàn Database (Prisma)**: Tất cả bảng CSDL mới được định nghĩa tách biệt. Nếu bổ sung trường vào model `Staff` cũ, 100% trường đều có tính chất tùy chọn (`? - Optional`), không bao giờ xoá hay đổi tên trường cũ.
3. **Giao diện chuẩn**: Luôn sử dụng Tabs dạng `type="card"` theo đúng quy chuẩn giao diện của bệnh viện.
