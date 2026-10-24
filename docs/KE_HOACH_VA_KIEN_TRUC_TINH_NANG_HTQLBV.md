# 🏥 TÀI LIỆU KIẾN TRÚC TÍNH NĂNG & BIỂU ĐỒ TRÌNH TỰ (SEQUENCE DIAGRAMS)
### Hệ thống Quản trị & Quản lý Chất lượng Bệnh viện Đa khoa Lạng Sơn

---

## 📑 MỤC LỤC
1. [Tổng quan Hệ thống Phân hệ](#1-tổng-quan-hệ-thống-phân-hệ)
2. [Bảng Tổng hợp Tất cả Tính năng Hệ thống](#2-bảng-tổng-hợp-tất-cả-tính-năng-hệ-thống)
3. [Sequence Diagram Chi tiết từng Chức năng](#3-sequence-diagram-chi-tiết-từng-chức-năng)
   - [3.1. Quy trình Tiếp nhận & Xử lý Yêu cầu CNTT (1 Việc tập trung)](#31-quy-trình-tiếp-nhận--xử-lý-yêu-cầu-cntt-1-việc-tập-trung)
   - [3.2. Quy trình Chat Trao đổi & Cảnh báo Tin nhắn Thời gian thực](#32-quy-trình-chat-trao-đổi--cảnh-báo-tin-nhắn-thời-gian-thực)
   - [3.3. Quy trình Mẫu câu Trả lời Nhanh (Dùng chung CSDL + Tùy biến Cá nhân)](#33-quy-trình-mẫu-câu-trả-lời-nhanh-dùng-chung-csdl--tùy-biến-cá-nhân)
   - [3.4. Quy trình Hòm thư Góp ý Đa kênh (Bệnh nhân QR, Chính sách, Chức năng)](#34-quy-trình-hòm-thư-góp-ý-đa-kênh-bệnh-nhân-qr-chính-sách-chức-năng)
   - [3.5. Quy trình Tủ sách Hướng dẫn & Quản lý Thay đổi (FeatureDocDrawer)](#35-quy-trình-tủ-sách-hướng-dẫn--quản-lý-thay-đổi-featuredocdrawer)
4. [Kế hoạch Phát triển & Vận hành Tiếp theo](#4-kế-hoạch-phát-triển--vận-hành-tiếp-theo)

---

## 1. TỔNG QUAN HỆ THỐNG PHÂN HỆ

Hệ thống được thiết kế theo kiến trúc hiện đại **Next.js App Router + TypeScript + TailwindCSS + Ant Design**, kết nối CSDL **PostgreSQL qua Prisma ORM**:

```mermaid
graph TD
    UserKP["Khoa / Phòng / Nhân viên"] --> UI["Giao diện Web HTQLBV"]
    UserPatient["Bệnh nhân / Người nhà (Mobile QR)"] --> UI
    UserIT["Bộ phận CNTT / VTYT / HCQT"] --> UI
    UserAdmin["Ban Giám đốc / Admin"] --> UI

    UI --> API["Next.js Server API Routes"]
    API --> DB[("PostgreSQL Database (Prisma)")]
    API --> NotifService["Dịch vụ Thông báo (Web Push, Zalo, SSE, Desktop)"]
    API --> LocalStorage["Trình duyệt Client (LocalStorage / Cache)"]
```

---

## 2. BẢNG TỔNG HỢP TẤT CẢ TÍNH NĂNG HỆ THỐNG

| STT | Phân hệ | Tên tính năng | Đối tượng sử dụng | Mô tả chức năng |
| :---: | :--- | :--- | :--- | :--- |
| **I** | **Quản lý Yêu cầu CNTT & Kỹ thuật** | **Tạo & Gửi yêu cầu hỗ trợ** | Khoa/Phòng | Nhập mã bệnh án, chọn lỗi thường gặp hoặc gõ nội dung, đính kèm ảnh, tự động điền SĐT người báo. |
| 2 | | **Tiếp nhận 1 việc tập trung** | Kỹ thuật viên CNTT | Khi nhận 1 phiếu mới, phiếu đang xử lý cũ tự động chuyển sang **Tạm dừng** để tránh phân tán việc. |
| 3 | | **Trao đổi Chat đa kênh** | Khoa/Phòng, CNTT, Đối tác ngoài | 2 kênh riêng biệt: Kênh Nội bộ (Khoa - CNTT) và Kênh Đối tác phần mềm (VNPT, Viettel, FPT...). |
| 4 | | **Mẫu câu trả lời nhanh** | Admin, CNTT, Khoa/Phòng | Admin khai báo mẫu chung toàn viện (CSDL); Từng tài khoản tự lưu mẫu riêng; Hỗ trợ Bật/Tắt, dàn hàng 100% câu chữ. |
| 5 | | **Cảnh báo thời gian thực** | CNTT | Chuông âm thanh + Popup góc màn hình + Desktop Windows Notification + Nhấp nháy Tab + Web Push. |
| 6 | | **Bộ lọc thông minh** | Mọi tài khoản | Lọc trạng thái, lọc theo ngày, nút **Tin chưa đọc** (huy hiệu đỏ), Dropdown chuyển chế độ xem (Tự động/Thẻ/Bảng). |
| 7 | | **Việc gửi ngoài (Vendor Ticket)** | CNTT, Điều phối | Quản lý phiếu gửi đối tác xử lý, hẹn ngày trả kết quả, đồng bộ mã ticket hãng. |
| **II** | **Hòm thư Góp ý 3 Kênh** | **Kênh 1: Góp ý Chức năng phần mềm** | Cán bộ nhân viên | Gửi phản ánh/lỗi phần mềm đang dùng, đính kèm file/ảnh; Admin phản hồi tiếp thu hoặc giải trình. |
| 9 | | **Kênh 2: Góp ý Văn bản & Chính sách** | Khoa/Phòng | Đăng tải dự thảo quy định, kiểm tra hạn góp ý (`endDate`, `isActive`); Khoa phòng đọc văn bản và gửi góp ý. |
| 10 | | **Kênh 3: Góp ý Người bệnh qua QR** | Bệnh nhân / Thân nhân | Quét mã QR tại buồng bệnh/phòng khám trên điện thoại; Tự động kiểm tra đợt khảo sát còn hiệu lực mới cho gửi. |
| 11 | | **Quản trị hòm thư & Xuất Excel** | Lãnh đạo, Admin | 3 Tabs quản lý tập trung, thống kê mức độ hài lòng, quản lý mã QR, tải báo cáo Excel đầy đủ. |
| **III** | **Tủ sách Hướng dẫn & Quản lý Thay đổi** | **Tủ sách hướng dẫn sử dụng** | Toàn viện | Nút nổi góc màn hình; Xem tài liệu hướng dẫn chuẩn hóa của từng màn hình; Admin soạn thảo bằng JoditEditor. |
| 13 | | **Nhật ký thay đổi (Change Logs)** | Toàn viện, Admin | Xem lịch sử các đợt cập nhật, tính năng mới, phiên bản phần mềm theo thời gian. |
| **IV** | **Giám sát BHYT & Hồ sơ XML** | **Kiểm tra trùng lặp BHYT** | Tổ BHYT, KHTH | Phát hiện trùng lặp bác sĩ khám, trùng giường, chỉ định trùng dịch vụ kỹ thuật theo Quyết định 130/QĐ-BYT. |
| 15 | | **Khám sức khỏe toàn dân** | Phòng KSK, Đối tác | Cổng tra cứu, import danh sách cơ quan, quản lý hồ sơ khám sức khỏe định kỳ. |

---

## 3. SEQUENCE DIAGRAM CHI TIẾT TỪNG CHỨC NĂNG

### 3.1. Quy trình Tiếp nhận & Xử lý Yêu cầu CNTT (1 Việc tập trung)

```mermaid
sequenceDiagram
    autonumber
    actor KP as Khoa/Phòng
    actor CNTT as Kỹ thuật viên CNTT
    participant UI as Giao diện Web (SharedRequestsPage)
    participant API as Backend API (/api/error-management/it-requests)
    participant DB as CSDL PostgreSQL (Prisma)
    participant Notif as Dịch vụ Thông báo

    KP->>UI: Tạo yêu cầu mới (Mã BA, Lỗi, Ảnh)
    UI->>API: POST /api/error-management/it-requests
    API->>DB: Tạo Ticket (Status = PENDING, targetDepartment = CNTT)
    DB-->>API: Hoàn tất tạo phiếu
    API->>Notif: Bắn thông báo có việc mới chờ xử lý (Desktop/Audio/Push)
    API-->>UI: Trả về thành công
    UI-->>KP: Thông báo tạo yêu cầu thành công

    Note over CNTT, UI: CNTT đang có việc A (Status = IN_PROGRESS)
    CNTT->>UI: Bấm "Nhận việc" tại Ticket B
    UI->>UI: Phát hiện đang có việc A đang chạy
    UI->>CNTT: Hiện Popup xác nhận: Chuyển việc A về TẠM DỪNG?
    CNTT->>UI: Chọn "Đồng ý & Bắt đầu"
    UI->>API: PUT /api/error-management/it-requests (Chuyển A -> PAUSED, B -> IN_PROGRESS)
    API->>DB: Cập nhật Transaction trạng thái 2 ticket
    DB-->>API: Cập nhật thành công
    API-->>UI: Trả về dữ liệu mới
    UI-->>CNTT: Bắt đầu bấm giờ Ticket B, Ticket A chuyển Tạm dừng
```

---

### 3.2. Quy trình Chat Trao đổi & Cảnh báo Tin nhắn Thời gian thực

```mermaid
sequenceDiagram
    autonumber
    actor KP as Khoa/Phòng
    actor CNTT as Kỹ thuật viên CNTT
    participant UI_KP as Màn hình Chat Khoa
    participant UI_CNTT as Màn hình CNTT (useTickets)
    participant API as API Messages (/api/.../it-requests/[id]/messages)
    participant DB as CSDL PostgreSQL
    participant Push as Web Push & Sound Engine

    KP->>UI_KP: Nhập tin nhắn hoặc chọn Mẫu câu -> Gửi
    UI_KP->>API: POST /api/error-management/it-requests/[id]/messages
    API->>DB: Lưu RequestMessage (channel = INTERNAL, readBy = [senderId])
    
    par Thông báo đẩy Backend
        API->>Push: Gửi Web Push Notification đến Assignee CNTT (hoặc nhóm CNTT)
        API->>Push: Gửi Zalo Webhook nhóm hỗ trợ (nếu có cấu hình)
    end
    API-->>UI_KP: Trả về tin nhắn đã gửi

    Note over UI_CNTT, API: useTickets Polling chu kỳ 5 giây
    UI_CNTT->>API: GET /api/error-management/it-requests
    API->>DB: Query tickets kèm unreadMessageCount
    DB-->>API: Trả về danh sách tickets
    API-->>UI_CNTT: Dữ liệu tickets (phát hiện unreadMessageCount tăng)

    UI_CNTT->>UI_CNTT: Phát hiện tin nhắn mới từ Khoa phòng
    par Kích hoạt cảnh báo Đa kênh trên máy CNTT
        UI_CNTT->>CNTT: 🔊 Phát chuông âm thanh (playNotificationSound)
        UI_CNTT->>CNTT: 💬 Hiển thị Popup Antd góc dưới (kèm nút "Mở xem trao đổi")
        UI_CNTT->>CNTT: 🖥️ Bắn Desktop Notification ngoài Windows
        UI_CNTT->>CNTT: 🚨 Nhấp nháy tiêu đề Tab trình duyệt
        UI_CNTT->>CNTT: 🔴 Cập nhật Badge đỏ nút Chat & Nút "Tin chưa đọc"
    end

    CNTT->>UI_CNTT: Click vào thông báo / Nút Chat
    UI_CNTT->>UI_CNTT: Mở TicketChatModal của phiếu đó (Polling 2s)
    UI_CNTT->>API: GET /messages (Tự động đánh dấu readBy cho CNTT)
```

---

### 3.3. Quy trình Mẫu câu Trả lời Nhanh (Dùng chung CSDL + Tùy biến Cá nhân)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản trị viên / CNTT
    actor User as Nhân viên / Khoa phòng
    participant Modal as Modal Quản lý Mẫu câu (TicketChatModal)
    participant Local as Trình duyệt LocalStorage
    participant API as API Quick Replies (/api/error-management/quick-replies)
    participant DB as CSDL SpecializedRule

    rect rgb(240, 248, 255)
        Note over Admin, DB: Bước 1: Admin tạo & lưu mẫu chuẩn toàn viện
        Admin->>Modal: Thêm/Sửa/Bật/Tắt các mẫu câu thường dùng
        Admin->>Modal: Bấm "Lưu mẫu chung toàn viện"
        Modal->>API: POST /api/error-management/quick-replies { templates }
        API->>DB: Upsert vào SpecializedRule (slug = it-request-quick-replies)
        DB-->>API: Lưu thành công
        API-->>Modal: Phản hồi thành công
        Modal-->>Admin: Thông báo "Đã lưu làm mẫu chung cho toàn viện!"
    end

    rect rgb(255, 250, 240)
        Note over User, DB: Bước 2: Tài khoản người dùng mở Chat
        User->>Modal: Mở khung Chat lần đầu
        Modal->>Local: Đọc localStorage (it_request_quick_replies_username)
        alt Chưa có cấu hình riêng ở Local
            Modal->>API: GET /api/error-management/quick-replies
            API->>DB: Lấy mẫu chung toàn viện
            DB-->>API: Trả về templates Admin đã lưu
            API-->>Modal: Trả về danh sách templates
            Modal-->>User: Hiển thị dàn hàng 100% câu chữ dùng chung
        else Đã có cấu hình cá nhân
            Local-->>Modal: Trả về danh sách tùy biến cá nhân
            Modal-->>User: Hiển thị mẫu riêng của tài khoản đó
        end
    end

    rect rgb(245, 255, 245)
        Note over User, DB: Bước 3: Người dùng muốn quay về mẫu chuẩn Admin
        User->>Modal: Bấm nút "Tải lại mẫu Admin"
        Modal->>Local: Xóa key cá nhân (removeItem)
        Modal->>API: GET /api/error-management/quick-replies
        API-->>Modal: Trả về mẫu chuẩn Admin
        Modal-->>User: Đồng bộ và hiển thị nguyên bản mẫu chung bệnh viện
    end
```

---

### 3.4. Quy trình Hòm thư Góp ý Đa kênh (Bệnh nhân QR, Chính sách, Chức năng)

```mermaid
sequenceDiagram
    autonumber
    actor BN as Bệnh nhân / Người nhà
    actor Admin as Lãnh đạo / Quản trị viên
    participant Mobile as Trình duyệt Điện thoại (/gop-y-benh-nhan)
    participant AdminUI as Quản trị Góp ý (/admin/feedbacks)
    participant API as API Backend
    participant DB as CSDL PostgreSQL

    BN->>Mobile: Quét mã QR tại Giường bệnh / Phòng khám
    Mobile->>API: GET /api/patient-campaigns/check?id=...
    API->>DB: Kiểm tra đợt khảo sát (isActive, startDate, endDate)
    
    alt Đợt góp ý ĐÃ HẾT HẠN hoặc ĐANG TẮT
        DB-->>API: isActive = false hoặc quá hạn
        API-->>Mobile: Thông báo "Chương trình góp ý đã kết thúc"
        Mobile-->>BN: Hiển thị thông báo kết thúc, không cho nhập liệu
    else Đợt góp ý ĐANG HOẠT ĐỘNG
        DB-->>API: Hợp lệ
        API-->>Mobile: Trả về thông tin đợt & Form khảo sát
        BN->>Mobile: Điền đánh giá (1-5 sao, tiêu chí, ý kiến, ẩn danh)
        BN->>Mobile: Bấm "Gửi góp ý"
        Mobile->>API: POST /api/patient-campaigns/submit
        API->>DB: Lưu PatientFeedbackRecord
        DB-->>API: Thành công
        Mobile-->>BN: Hiển thị màn hình cảm ơn & ghi nhận
    end

    Admin->>AdminUI: Vào trang Quản trị Hòm thư góp ý (/admin/feedbacks)
    AdminUI->>API: GET danh sách 3 kênh (Bệnh nhân, Chính sách, Chức năng)
    API->>DB: Query dữ liệu tổng hợp
    DB-->>API: Trả về danh sách
    AdminUI-->>Admin: Xem biểu đồ thống kê, Bật/Tắt đợt, Xuất file Excel
```

---

### 3.5. Quy trình Tủ sách Hướng dẫn & Quản lý Thay đổi (FeatureDocDrawer)

```mermaid
sequenceDiagram
    autonumber
    actor User as Nhân viên Khoa phòng
    actor Admin as Quản trị viên hệ thống
    participant FloatBtn as Nút tròn góc phải (w-9 h-9)
    participant Drawer as FeatureDocDrawer
    participant API as API PageInstructions & ChangeLogs
    participant DB as CSDL PostgreSQL

    User->>FloatBtn: Click vào nút sách góc dưới phải màn hình
    FloatBtn->>Drawer: Mở ngăn kéo (Drawer size 760px)
    Drawer->>API: GET /api/page-instructions?pageId={currentPath}
    Drawer->>API: GET /api/feature-change-logs?pageId={currentPath}
    API->>DB: Lấy tài liệu hướng dẫn & lịch sử cập nhật của trang hiện tại
    DB-->>API: Trả về nội dung
    API-->>Drawer: Dữ liệu hướng dẫn HTML & danh sách phiên bản
    Drawer-->>User: Hiển thị Tab Tài liệu, Tab Lịch sử phiên bản, Tab Ý kiến

    opt Khi Quản trị viên muốn cập nhật hướng dẫn
        Admin->>Drawer: Bấm "Chỉnh sửa tài liệu"
        Drawer-->>Admin: Mở trình soạn thảo WYSIWYG JoditEditor
        Admin->>Drawer: Soạn thảo nội dung, chèn ảnh/video -> Bấm "Lưu"
        Drawer->>API: POST /api/page-instructions
        API->>DB: Lưu PageInstruction
        DB-->>API: Lưu thành công
        Drawer-->>Admin: Cập nhật tài liệu mới cho toàn viện ngay lập tức
    end
```

---

## 4. KẾ HOẠCH PHÁT TRIỂN & VẬN HÀNH TIẾP THEO

### Giai đoạn 1: Ổn định & Tối ưu hóa Hiện tại (Tuần 1)
- [x] Đã khôi phục thanh bộ lọc 1 hàng chuẩn kèm nút Dropdown thông minh.
- [x] Đã hoàn thành Mẫu câu trả lời nhanh CSDL + LocalStorage + Dàn hàng 100%.
- [x] Đã tích hợp chuông báo, popup, desktop notification và nhấp nháy tab khi có tin nhắn từ Khoa.
- [x] Đã thu nhỏ nút Tủ sách hướng dẫn (36px) và xóa cảnh báo Ant Design `Spin tip`.
- [ ] Tập huấn ngắn cho tổ Kỹ thuật CNTT về thao tác 1 việc tập trung và sử dụng mẫu câu trả lời nhanh.

### Giai đoạn 2: Báo cáo & Đánh giá Hiệu năng KPI (Tuần 2 - 3)
- [ ] Xây dựng Dashboard thống kê thời gian phản hồi trung bình (SLA) của từng kỹ thuật viên CNTT.
- [ ] Báo cáo tỷ lệ hài lòng của các Khoa phòng đối với dịch vụ hỗ trợ của CNTT.
- [ ] Tích hợp tính năng đánh giá sao (1 - 5 sao) trực tiếp khi Khoa phòng bấm xác nhận hoàn thành phiếu hỗ trợ.

### Giai đoạn 3: Mở rộng Đa nền tảng & Tự động hóa (Tháng tiếp theo)
- [ ] Tích hợp Zalo ZNS / Mini App gửi thông báo tự động cho bệnh nhân sau khi xuất viện để lấy ý kiến đóng góp.
- [ ] Gửi báo cáo tổng hợp sự cố CNTT hàng tuần tự động vào email Ban Giám đốc và Lãnh đạo phòng CNTT.
