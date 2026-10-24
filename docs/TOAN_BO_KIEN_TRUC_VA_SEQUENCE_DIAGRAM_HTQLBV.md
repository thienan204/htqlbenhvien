# 🏥 TOÀN BỘ KIẾN TRÚC & BIỂU ĐỒ TRÌNH TỰ (SEQUENCE DIAGRAMS)
### Hệ thống Quản trị & Quản lý Chất lượng Bệnh viện Đa khoa Lạng Sơn (HTQLBV)

---

## 📌 MỤC LỤC ĐIỀU HƯỚNG
- [1. SƠ ĐỒ TỔNG THỂ TOÀN HỆ THỐNG (MASTER SYSTEM ARCHITECTURE)](#1-sơ-đồ-tổng-thể-toàn-hệ-thống-master-system-architecture)
- [2. BIỂU ĐỒ TRÌNH TỰ CHI TIẾT TỪNG PHÂN HỆ](#2-biểu-đồ-trình-tự-chi-tiết-từng-phân-hệ)
  - [2.1. Xác thực Đăng nhập & Ma trận Phân quyền Đa cấp độ (Auth & RBAC)](#21-xác-thực-đăng-nhập--ma-trận-phân-quyền-đa-cấp-độ-auth--rbac)
  - [2.2. Quản lý Nhân sự, Khoa Phòng & Chứng chỉ Hành nghề (Staff & Department)](#22-quản-lý-nhân-sự-khoa-phòng--chứng-chỉ-hành-nghề-staff--department)
  - [2.3. Bóc tách & Kiểm tra Hồ sơ XML BHYT theo Quyết định 130/QĐ-BYT (Check XML)](#23-bóc-tách--kiểm-tra-hồ-sơ-xml-bhyt-theo-quyết-định-130qđ-byt-check-xml)
  - [2.4. Động cơ Kiểm tra Chuyên đề Trùng lặp BHYT (Specialized Rules Engine)](#24-động-cơ-kiểm-tra-chuyên-đề-trùng-lặp-bhyt-specialized-rules-engine)
  - [2.5. Quản lý Yêu cầu Kỹ thuật & Tiếp nhận 1 Việc Tập trung (IT Requests)](#25-quản-lý-yêu-cầu-kỹ-thuật--tiếp-nhận-1-việc-tập-trung-it-requests)
  - [2.6. Hệ thống Chat Đa kênh & Cảnh báo Thời gian thực (Real-time Notification)](#26-hệ-thống-chat-đa-kênh--cảnh-báo-thời-gian-thực-real-time-notification)
  - [2.7. Hòm thư Góp ý 3 Kênh & Khảo sát Người bệnh qua QR Mobile (Feedback)](#27-hòm-thư-góp-ý-3-kênh--khảo-sát-người-bệnh-qua-qr-mobile-feedback)
  - [2.8. Tủ sách Hướng dẫn Sử dụng & Quản lý Thay đổi (FeatureDocDrawer)](#28-tủ-sách-hướng-dẫn-sử-dụng--quản-lý-thay-đổi-featuredocdrawer)
- [3. TỔNG HỢP CÁC BẢNG CƠ SỞ DỮ LIỆU & ENDPOINTS CHÍNH](#3-tổng-hợp-các-bảng-cơ-sở-dữ-liệu--endpoints-chính)

---

## 1. SƠ ĐỒ TỔNG THỂ TOÀN HỆ THỐNG (MASTER SYSTEM ARCHITECTURE)

> **💡 HƯỚNG DẪN TƯƠNG TÁC:**
> Bấm (click) vào bất kỳ khối chức năng nào trong sơ đồ dưới đây để tự động nhảy đến **Sequence Diagram chi tiết** của chức năng đó!

```mermaid
flowchart TD
    classDef auth fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef staff fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef xml fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef it fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;
    classDef notif fill:#ffedd5,stroke:#ea580c,stroke-width:2px;
    classDef feedback fill:#ffe4e6,stroke:#e11d48,stroke-width:2px;
    classDef doc fill:#f1f5f9,stroke:#475569,stroke-width:2px;
    classDef core fill:#ffffff,stroke:#0f172a,stroke-width:3px;

    User["👥 NGƯỜI DÙNG BỆNH VIỆN<br/>(Bác sĩ, Điều dưỡng, CNTT, KHTH, Bệnh nhân, Giám đốc)"] --> Gateway["🔐 CỔNG ĐĂNG NHẬP & KIỂM SOÁT PHÂN QUYỀN"]:::core

    Gateway --> S1["1. Xác thực & Phân quyền RBAC"]:::auth
    Gateway --> S2["2. Quản lý Nhân sự & Khoa phòng"]:::staff
    Gateway --> S3["3. Bóc tách & Kiểm tra XML 1-5 (QĐ 130)"]:::xml
    Gateway --> S4["4. Kiểm tra Chuyên đề Trùng lặp BHYT"]:::xml
    Gateway --> S5["5. Yêu cầu Kỹ thuật & Tiếp nhận 1 việc"]:::it
    Gateway --> S6["6. Chat Đa kênh & Cảnh báo Tức thì"]:::notif
    Gateway --> S7["7. Hòm thư Góp ý 3 Kênh (QR Mobile)"]:::feedback
    Gateway --> S8["8. Tủ sách Hướng dẫn & Nhật ký Thay đổi"]:::doc

    S1 --> DB[("🗄️ CƠ SỞ DỮ LIỆU POSTGRESQL (PRISMA ORM)")]:::core
    S2 --> DB
    S3 --> DB
    S4 --> DB
    S5 --> DB
    S6 --> DB
    S7 --> DB
    S8 --> DB

    click S1 href "#21-xác-thực-đăng-nhập--ma-trận-phân-quyền-đa-cấp-độ-auth--rbac" "Xem chi tiết Sequence Xác thực & Phân quyền"
    click S2 href "#22-quản-lý-nhân-sự-khoa-phòng--chứng-chỉ-hành-nghề-staff--department" "Xem chi tiết Sequence Quản lý Nhân sự & Khoa phòng"
    click S3 href "#23-bóc-tách--kiểm-tra-hồ-sơ-xml-bhyt-theo-quyết-định-130qđ-byt-check-xml" "Xem chi tiết Sequence Bóc tách & Kiểm tra XML"
    click S4 href "#24-động-cơ-kiểm-tra-chuyên-đề-trùng-lặp-bhyt-specialized-rules-engine" "Xem chi tiết Sequence Kiểm tra Chuyên đề Trùng lặp"
    click S5 href "#25-quản-lý-yêu-cầu-kỹ-thuật--tiếp-nhận-1-việc-tập-trung-it-requests" "Xem chi tiết Sequence Tiếp nhận Yêu cầu 1 việc"
    click S6 href "#26-hệ-thống-chat-đa-kênh--cảnh-báo-thời-gian-thực-real-time-notification" "Xem chi tiết Sequence Chat & Cảnh báo Tức thì"
    click S7 href "#27-hòm-thư-góp-ý-3-kênh--khảo-sát-người-bệnh-qua-qr-mobile-feedback" "Xem chi tiết Sequence Hòm thư Góp ý & QR Bệnh nhân"
    click S8 href "#28-tủ-sách-hướng-dẫn-sử-dụng--quản-lý-thay-đổi-featuredocdrawer" "Xem chi tiết Sequence Tủ sách Hướng dẫn"
```

---

## 2. BIỂU ĐỒ TRÌNH TỰ CHI TIẾT TỪNG PHÂN HỆ

### 2.1. Xác thực Đăng nhập & Ma trận Phân quyền Đa cấp độ (Auth & RBAC)

> **Mô tả nghiệp vụ:** Người dùng đăng nhập bằng tên tài khoản/mã nhân viên/CCCD. Hệ thống kiểm tra mật khẩu đã hash, cấp phiên làm việc JWT Cookie, sau đó kiểm tra ma trận phân quyền từng tính năng (`VIEW`, `CREATE`, `UPDATE`, `DELETE`) thông qua Middleware / `proxy.ts`.

```mermaid
sequenceDiagram
    autonumber
    actor User as Cán bộ Nhân viên / Bác sĩ
    participant UI as Giao diện Đăng nhập (/login)
    participant Proxy as Middleware / Proxy Guard (proxy.ts)
    participant AuthAPI as API Xác thực (/api/auth/login)
    participant DB as PostgreSQL (User & Role & Permission)

    User->>UI: Nhập tài khoản, mật khẩu (hoặc CCCD / Mã NV)
    UI->>AuthAPI: POST /api/auth/login { username, password }
    AuthAPI->>DB: Query User theo username kèm Roles & Permissions
    DB-->>AuthAPI: Trả về thông tin User + Hash Password + Ma trận quyền
    AuthAPI->>AuthAPI: So khớp bcrypt/argon2 mật khẩu
    
    alt Mật khẩu không đúng hoặc tài khoản bị khóa
        AuthAPI-->>UI: Trả về lỗi 401: Sai mật khẩu hoặc tài khoản đã tắt
        UI-->>User: Báo lỗi đỏ trên màn hình đăng nhập
    else Xác thực thành công
        AuthAPI->>AuthAPI: Sinh JWT Token (userId, role, ma_khoa, permissions)
        AuthAPI-->>UI: Đặt Set-Cookie (httpOnly, secure) & Trả về thông tin cơ bản
        UI-->>User: Chuyển hướng tới Trang Chủ hoặc Trang trước đó
    end

    Note over User, DB: Khi người dùng truy cập một tính năng cụ thể (ví dụ: /staff hoặc /admin)
    User->>Proxy: Yêu cầu mở trang /staff
    Proxy->>Proxy: Giải mã JWT Cookie từ Request
    alt Chưa đăng nhập hoặc Token hết hạn
        Proxy-->>User: Chuyển hướng ngay về /login?redirect=/staff
    else Đã đăng nhập
        Proxy->>Proxy: Kiểm tra ma trận quyền MenuPermission ('MENU_STAFF', 'VIEW')
        alt Không có quyền truy cập
            Proxy-->>User: Hiển thị trang 403 Forbidden: Bạn không có quyền truy cập
        else Có quyền hợp lệ
            Proxy-->>User: Tải giao diện và dữ liệu tính năng bình thường
        end
    end
```

[⬆ Quay lại Sơ đồ Tổng thể](#1-sơ-đồ-tổng-thể-toàn-hệ-thống-master-system-architecture)

---

### 2.2. Quản lý Nhân sự, Khoa Phòng & Chứng chỉ Hành nghề (Staff & Department)

> **Mô tả nghiệp vụ:** Quản lý cơ cấu tổ chức bệnh viện, khoa/phòng, thông tin nhân viên y tế, số chứng chỉ hành nghề (CCHN), phạm vi chuyên môn kỹ thuật được phép thực hiện, và phân công lịch trực lâm sàng.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Phòng Tổ chức Cán bộ / Admin
    participant UI as Quản lý Nhân sự (/staff & /departments)
    participant API as Backend API (/api/staff & /api/departments)
    participant DB as PostgreSQL (Staff, Department, PracticingCertificate)

    Admin->>UI: Thêm mới hoặc Cập nhật thông tin Bác sĩ / Nhân viên
    UI->>UI: Validate form (Mã NV, Họ tên, Mã Khoa, Số CCHN, Ngày cấp, Phạm vi CM)
    UI->>API: POST/PUT /api/staff { data }
    API->>API: Kiểm tra trùng lặp Số CCHN hoặc Mã NV
    API->>DB: Upsert dữ liệu Staff & PracticingCertificate
    DB-->>API: Lưu thành công
    API-->>UI: Phản hồi thành công
    UI-->>Admin: Hiển thị nhân viên trong danh sách Khoa/Phòng

    Note over Admin, DB: Đồng bộ phục vụ Giám định BHYT & Xếp lịch trực
    Admin->>UI: Mở Lịch trực lâm sàng (/clinical-scheduling)
    UI->>API: GET /api/duty-roster?month=10&year=2026&ma_khoa=K01
    API->>DB: Lấy danh sách ca trực theo phân công khoa
    DB-->>API: Trả về bảng lịch trực
    API-->>UI: Render bảng phân ca trực động
```

[⬆ Quay lại Sơ đồ Tổng thể](#1-sơ-đồ-tổng-thể-toàn-hệ-thống-master-system-architecture)

---

### 2.3. Bóc tách & Kiểm tra Hồ sơ XML BHYT theo Quyết định 130/QĐ-BYT (Check XML)

> **Mô tả nghiệp vụ:** Tiếp nhận gói hồ sơ XML (XML1: Tổng hợp; XML2: Thuốc; XML3: Dịch vụ kỹ thuật & Vật tư; XML4: Diễn biến bệnh; XML5: Khám bệnh). Phân tích cú pháp, kiểm tra lỗi kỹ thuật và đối chiếu cấu trúc chuẩn dữ liệu gửi cổng giám định BHYT.

```mermaid
sequenceDiagram
    autonumber
    actor BHYT as Cán bộ BHYT / KHTH
    participant UI as Giao diện Kiểm tra XML (/xml-checker)
    participant Worker as Trình duyệt Parser (Web Worker / Sax)
    participant API as Backend API (/api/xml/upload & validate)
    participant DB as PostgreSQL (Xml1..Xml5, XmlError)

    BHYT->>UI: Kéo thả tệp XML hoặc file nén .ZIP vào ô tải lên
    UI->>Worker: Khởi chạy luồng bóc tách dữ liệu ngầm (không đơ giao diện)
    Worker->>Worker: Đọc thẻ XML1 (MA_LK, MA_BN, NGAY_VAO, NGAY_RA...)
    Worker->>Worker: Đọc thẻ XML2 (Thuốc), XML3 (DVKT, VTYT)
    Worker-->>UI: Tiến trình hoàn thành 100% bóc tách
    
    UI->>API: Gửi dữ liệu đối soát lên Server
    API->>API: So khớp định dạng chuẩn Quyết định 130/QĐ-BYT
    API->>API: Kiểm tra mã danh mục dùng chung (Mã thuốc, Mã DVKT, Mã ICD10)
    API->>DB: Lưu các bản ghi lỗi phát hiện (XmlError)
    DB-->>API: Hoàn tất lưu vết lỗi
    API-->>UI: Trả về danh sách lỗi vi phạm kèm dòng & cột cụ thể
    UI-->>BHYT: Hiển thị bảng lỗi trực quan, cho phép sửa nhanh hoặc xuất Excel
```

[⬆ Quay lại Sơ đồ Tổng thể](#1-sơ-đồ-tổng-thể-toàn-hệ-thống-master-system-architecture)

---

### 2.4. Động cơ Kiểm tra Chuyên đề Trùng lặp BHYT (Specialized Rules Engine)

> **Mô tả nghiệp vụ:** Thuật toán phát hiện các vi phạm quy chế khám chữa bệnh dẫn đến nguy cơ xuất toán BHYT: 1 Bác sĩ khám tại 2 buồng trong cùng khung giờ; 1 Bệnh nhân nằm tại 2 giường khác nhau; trùng lặp dịch vụ kỹ thuật trong cùng ngày.

```mermaid
sequenceDiagram
    autonumber
    actor GiamDinh as Cán bộ Giám định / KHTH
    participant UI as Chuyên đề BHYT (/kiem-tra-chuyen-de)
    participant RuleEngine as Động cơ Quy tắc Chuyên đề (SpecializedRuleRunner)
    participant DB as CSDL Hồ sơ Bệnh án & Lịch trực
    participant Export as Bộ trích xuất Báo cáo ExcelJS

    GiamDinh->>UI: Chọn quy tắc: "Kiểm tra trùng Bác sĩ khám" & "Trùng Giường"
    GiamDinh->>UI: Bấm "Chạy kiểm tra chuyên đề"
    UI->>RuleEngine: Truyền dữ liệu hồ sơ XML và bộ quy tắc SpecializedRule
    
    par Kiểm tra Trùng Bác sĩ
        RuleEngine->>RuleEngine: Gom nhóm theo CCHN Bác sĩ + Mốc thời gian khám
        RuleEngine->>RuleEngine: Phát hiện 2 hồ sơ khác nhau có thời gian khám gối nhau
    and Kiểm tra Trùng Giường bệnh
        RuleEngine->>RuleEngine: Gom nhóm theo Mã Khoa + Số Giường + Ngày nằm viện
        RuleEngine->>RuleEngine: Phát hiện 2 bệnh nhân nằm cùng 1 giường cùng lúc
    and Kiểm tra Trùng Dịch vụ kỹ thuật
        RuleEngine->>RuleEngine: So sánh mã dịch vụ kỹ thuật trùng lặp trong đợt điều trị
    end

    RuleEngine-->>UI: Trả về kết quả phân tích vi phạm chi tiết
    UI-->>GiamDinh: Hiển thị bảng tổng hợp hồ sơ nghi vấn xuất toán
    GiamDinh->>UI: Bấm "Xuất Excel Báo cáo chuyên đề"
    UI->>Export: Sinh file Excel gồm nhiều Sheet kèm công thức và định dạng màu
    Export-->>GiamDinh: Tải về máy tính file Excel báo cáo hoàn chỉnh
```

[⬆ Quay lại Sơ đồ Tổng thể](#1-sơ-đồ-tổng-thể-toàn-hệ-thống-master-system-architecture)

---

### 2.5. Quản lý Yêu cầu Kỹ thuật & Tiếp nhận 1 Việc Tập trung (IT Requests)

> **Mô tả nghiệp vụ:** Tiếp nhận và xử lý sự cố CNTT, VTYT, Hậu cần. Thực hiện nghiêm ngặt quy chế **"Mỗi kỹ thuật viên chỉ tập trung 1 việc tại một thời điểm"**: Khi nhận việc mới, phiếu đang làm cũ tự động chuyển sang trạng thái Tạm dừng.

```mermaid
sequenceDiagram
    autonumber
    actor KP as Khoa/Phòng gặp sự cố
    actor KTV as Kỹ thuật viên CNTT
    participant UI as Trang Quản lý Yêu cầu (/error-management/it-requests)
    participant API as API Yêu cầu (/api/error-management/it-requests)
    participant DB as PostgreSQL (ITRequest, RequestLog)

    KP->>UI: Tạo phiếu yêu cầu (Mã BA, Chọn Lỗi thường gặp, Ảnh chụp)
    UI->>API: POST /api/error-management/it-requests
    API->>DB: Tạo Ticket mới (Status = PENDING, assigneeId = null)
    DB-->>API: Lưu thành công
    API-->>UI: Hoàn tất
    UI-->>KP: Báo tạo phiếu thành công, hiển thị trên bảng theo dõi

    Note over KTV, DB: KTV đang có Việc A (Status = IN_PROGRESS)
    KTV->>UI: Bấm "Nhận việc" tại Việc B (Status = PENDING)
    UI->>UI: Phát hiện KTV đang có việc A đang chạy
    UI->>KTV: Hộp thoại: "Phiếu cũ sẽ tự động chuyển sang TẠM DỪNG để bắt đầu việc này?"
    KTV->>UI: Bấm "Đồng ý & Bắt đầu"
    UI->>API: PUT /api/error-management/it-requests (Chuyển A -> PAUSED, B -> IN_PROGRESS, assigneeId = KTV)
    API->>DB: Chạy Transaction cập nhật trạng thái cả 2 ticket
    DB-->>API: Cập nhật thành công
    API-->>UI: Trả về danh sách mới
    UI-->>KTV: Bắt đầu bấm giờ việc B, việc A chuyển sang trạng thái Tạm dừng
```

[⬆ Quay lại Sơ đồ Tổng thể](#1-sơ-đồ-tổng-thể-toàn-hệ-thống-master-system-architecture)

---

### 2.6. Hệ thống Chat Đa kênh & Cảnh báo Thời gian thực (Real-time Notification)

> **Mô tả nghiệp vụ:** Trao đổi trực tiếp trên từng phiếu yêu cầu (Kênh nội bộ với Khoa và Kênh đối tác với hãng VNPT/Viettel/FPT). Khi Khoa phòng gửi tin nhắn, KTV phụ trách lập tức nhận chuông báo, popup góc màn hình, thông báo Desktop và nhấp nháy tab trình duyệt. Sử dụng mẫu câu trả lời nhanh dùng chung toàn viện kết hợp mẫu cá nhân.

```mermaid
sequenceDiagram
    autonumber
    actor KP as Khoa/Phòng
    actor KTV as Kỹ thuật viên CNTT
    participant UI_KP as Khung Chat Khoa
    participant UI_KTV as Màn hình KTV (useTickets Polling 5s)
    participant API_Msg as API Messages (/api/.../it-requests/[id]/messages)
    participant API_QR as API Mẫu câu (/api/.../quick-replies)
    participant DB as CSDL PostgreSQL
    participant Push as Web Push Notification Engine

    opt Admin lưu mẫu câu dùng chung
        KTV->>API_QR: POST /quick-replies (Lưu danh sách câu mẫu chung toàn viện)
        API_QR->>DB: Upsert SpecializedRule (slug = it-request-quick-replies)
    end

    KP->>UI_KP: Chọn Mẫu câu nhanh hoặc gõ tin nhắn -> Gửi
    UI_KP->>API_Msg: POST /messages { content, channel: 'INTERNAL' }
    API_Msg->>DB: Lưu RequestMessage (readBy = [KP.id])
    API_Msg->>Push: Bắn Web Push Notification tới KTV phụ trách
    API_Msg-->>UI_KP: Hiển thị tin nhắn đã gửi

    Note over UI_KTV, API_Msg: Chu kỳ Polling 5 giây phát hiện tin mới
    UI_KTV->>DB: Lấy danh sách ticket kèm unreadMessageCount
    DB-->>UI_KTV: unreadMessageCount của phiếu tăng lên
    UI_KTV->>UI_KTV: Kích hoạt cảnh báo Đa kênh tức thì:
    par Cảnh báo KTV
        UI_KTV->>KTV: 🔊 Phát chuông âm thanh (playNotificationSound)
        UI_KTV->>KTV: 💬 Hiện Popup Antd góc dưới (kèm nút "Mở xem trao đổi")
        UI_KTV->>KTV: 🖥️ Bắn Desktop Windows Notification ngoài màn hình
        UI_KTV->>KTV: 🚨 Nhấp nháy Tab: "💬 (1) Tin nhắn mới từ Khoa!"
        UI_KTV->>KTV: 🔴 Hiện Badge đỏ trên nút Chat của dòng phiếu
    end

    KTV->>UI_KTV: Bấm vào thông báo -> Mở ngay TicketChatModal (Polling 2s)
    UI_KTV->>API_Msg: GET /messages (Tự động cập nhật readBy cho KTV)
```

[⬆ Quay lại Sơ đồ Tổng thể](#1-sơ-đồ-tổng-thể-toàn-hệ-thống-master-system-architecture)

---

### 2.7. Hòm thư Góp ý 3 Kênh & Khảo sát Người bệnh qua QR Mobile (Feedback)

> **Mô tả nghiệp vụ:** Hệ thống hòm thư góp ý 3 kênh: (1) Bệnh nhân quét mã QR tại buồng bệnh/bàn khám trên điện thoại (tự động kiểm tra hạn và trạng thái hiệu lực); (2) Khoa/Phòng góp ý dự thảo văn bản chính sách; (3) Cán bộ nhân viên góp ý chức năng phần mềm kèm file đính kèm.

```mermaid
sequenceDiagram
    autonumber
    actor BN as Bệnh nhân / Thân nhân
    actor Admin as Ban Giám đốc / Tổ Quản lý Chất lượng
    participant Mobile as Điện thoại Quét QR (/gop-y-benh-nhan)
    participant AdminUI as Quản trị Hòm thư (/admin/feedbacks)
    participant API as Backend API Campaigns & Feedbacks
    participant DB as PostgreSQL (PatientCampaign, Policy, Feedback)

    BN->>Mobile: Quét mã QR dán tại Giường bệnh / Bàn khám
    Mobile->>API: GET /api/patient-campaigns/check?id=...
    API->>DB: Kiểm tra đợt khảo sát (isActive, startDate, endDate)
    
    alt Đợt khảo sát ĐÃ HẾT HẠN hoặc ĐANG TẮT
        DB-->>API: isActive = false hoặc quá hạn ngày kết thúc
        API-->>Mobile: Trả về trạng thái kết thúc
        Mobile-->>BN: Thông báo: "Chương trình khảo sát đã kết thúc. Xin cảm ơn!"
    else Đợt khảo sát ĐANG CÒN HIỆU LỰC
        DB-->>API: Hợp lệ
        API-->>Mobile: Trả về thông tin đợt & Bộ câu hỏi đánh giá
        BN->>Mobile: Đánh giá số sao (1-5 sao), chọn tiêu chí hài lòng, gửi ý kiến
        BN->>Mobile: Bấm "Gửi ý kiến đóng góp"
        Mobile->>API: POST /api/patient-campaigns/submit { data }
        API->>DB: Lưu bản ghi PatientFeedbackRecord
        DB-->>API: Lưu thành công
        Mobile-->>BN: Màn hình cảm ơn và ghi nhận ý kiến
    end

    Admin->>AdminUI: Vào trang Quản trị Hòm thư góp ý (/admin/feedbacks)
    AdminUI->>API: GET dữ liệu 3 kênh (Bệnh nhân, Chính sách, Chức năng)
    API->>DB: Query tổng hợp số liệu
    DB-->>API: Trả về danh sách
    AdminUI-->>Admin: Xem biểu đồ tỷ lệ hài lòng, duyệt ý kiến, xuất báo cáo Excel
```

[⬆ Quay lại Sơ đồ Tổng thể](#1-sơ-đồ-tổng-thể-toàn-hệ-thống-master-system-architecture)

---

### 2.8. Tủ sách Hướng dẫn Sử dụng & Quản lý Thay đổi (FeatureDocDrawer)

> **Mô tả nghiệp vụ:** Tủ sách hướng dẫn tích hợp tại mọi màn hình chức năng thông qua nút nổi nhỏ gọn ở góc dưới bên phải màn hình. Người dùng xem tài liệu chuẩn hóa và lịch sử cập nhật phiên bản. Quản trị viên có thể soạn thảo trực tiếp bằng JoditEditor.

```mermaid
sequenceDiagram
    autonumber
    actor User as Nhân viên Y tế
    actor Admin as Quản trị viên Chức năng
    participant FloatBtn as Nút Sách nổi góc phải (w-9 h-9)
    participant Drawer as Ngăn kéo FeatureDocDrawer (size 760px)
    participant API as API (/api/page-instructions & /api/feature-change-logs)
    participant DB as PostgreSQL (PageInstruction, FeatureChangeLog)

    User->>FloatBtn: Bấm vào nút sách nhỏ gọn góc dưới phải
    FloatBtn->>Drawer: Mở ngăn kéo trượt từ cạnh phải
    Drawer->>API: GET /api/page-instructions?pageId={currentCleanPath}
    Drawer->>API: GET /api/feature-change-logs?pageId={currentCleanPath}
    API->>DB: Lấy tài liệu hướng dẫn & lịch sử cập nhật của trang hiện tại
    DB-->>API: Trả về nội dung
    API-->>Drawer: Dữ liệu HTML hướng dẫn & danh sách phiên bản
    Drawer-->>User: Hiển thị 3 Tabs: Hướng dẫn sử dụng | Nhật ký thay đổi | Đóng góp ý kiến

    opt Khi Quản trị viên cần cập nhật tài liệu
        Admin->>Drawer: Bấm nút "Chỉnh sửa tài liệu"
        Drawer-->>Admin: Mở trình soạn thảo WYSIWYG JoditEditor
        Admin->>Drawer: Soạn thảo văn bản, chèn ảnh, bảng biểu -> Bấm "Lưu"
        Drawer->>API: POST /api/page-instructions { pageId, content }
        API->>DB: Upsert PageInstruction
        DB-->>API: Lưu thành công
        Drawer-->>Admin: Báo thành công, tài liệu cập nhật ngay cho toàn viện
    end
```

[⬆ Quay lại Sơ đồ Tổng thể](#1-sơ-đồ-tổng-thể-toàn-hệ-thống-master-system-architecture)

---

## 3. TỔNG HỢP CÁC BẢNG CƠ SỞ DỮ LIỆU & ENDPOINTS CHÍNH

| Phân hệ | Các Bảng CSDL (Prisma Models) | Endpoints API chính | Màn hình giao diện |
| :--- | :--- | :--- | :--- |
| **1. Xác thực & Phân quyền** | `User`, `Role`, `UserRole`, `MenuPermission` | `/api/auth/login`, `/api/auth/me`, `/api/users`, `/api/roles` | `/login`, `/users`, `/roles` |
| **2. Quản lý Nhân sự & Tổ chức** | `Staff`, `Department`, `PracticingCertificate`, `Specialty` | `/api/staff`, `/api/departments`, `/api/duty-roster` | `/staff`, `/departments`, `/clinical-scheduling` |
| **3. Giám định Hồ sơ XML BHYT** | `Xml1`, `Xml2`, `Xml3`, `Xml4`, `Xml5`, `XmlError` | `/api/xml/upload`, `/api/xml/validate`, `/api/xml/errors` | `/xml-checker`, `/xml-sua-ba`, `/xml3` |
| **4. Kiểm tra Chuyên đề Trùng lặp** | `SpecializedRule`, `SpecializedResult` | `/api/specialized-rules`, `/api/specialized-export` | `/kiem-tra-chuyen-de`, `/chuyen-de` |
| **5. Yêu cầu Kỹ thuật & Sự cố** | `ITRequest`, `RequestLog` | `/api/error-management/it-requests`, `/api/error-management/it-request-config` | `/error-management/it-requests` |
| **6. Chat Đa kênh & Cảnh báo** | `RequestMessage`, `NotificationSetting` | `/api/error-management/it-requests/[id]/messages`, `/api/error-management/quick-replies` | `TicketChatModal`, `useTickets` |
| **7. Hòm thư Góp ý 3 Kênh** | `PatientFeedbackCampaign`, `PatientFeedbackRecord`, `HospitalPolicy`, `FeatureFeedback` | `/api/patient-campaigns`, `/api/hospital-policies`, `/api/feature-feedback` | `/gop-y-benh-nhan`, `/gop-y-chinh-sach`, `/admin/feedbacks` |
| **8. Tủ sách & Nhật ký Thay đổi** | `PageInstruction`, `FeatureChangeLog` | `/api/page-instructions`, `/api/feature-change-logs` | `FeatureDocDrawer`, `/huong-dan` |
