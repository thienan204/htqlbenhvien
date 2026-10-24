'use client';

import React, { useState } from 'react';
import { Tabs, Card, Tag, Button, Alert, Collapse, Tooltip } from 'antd';
import {
    ApartmentOutlined, TeamOutlined, DeploymentUnitOutlined,
    CheckCircleOutlined, ThunderboltOutlined, BookOutlined,
    SafetyCertificateOutlined, FileTextOutlined, ClockCircleOutlined,
    DollarCircleOutlined, AuditOutlined
} from '@ant-design/icons';
import MermaidViewer from '@/components/common/MermaidViewer';

// Sơ đồ tổng thể hệ thống HTQLBV
const MASTER_SYSTEM_CHART = `
flowchart TD
    classDef auth fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef staff fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef xml fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef it fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;
    classDef notif fill:#ffedd5,stroke:#ea580c,stroke-width:2px;
    classDef feedback fill:#ffe4e6,stroke:#e11d48,stroke-width:2px;
    classDef doc fill:#f1f5f9,stroke:#475569,stroke-width:2px;
    classDef core fill:#ffffff,stroke:#0f172a,stroke-width:3px;

    User["👥 Người dùng Bệnh viện<br/>(Bác sĩ, Điều dưỡng, CNTT, KHTH, Bệnh nhân)"] --> Gateway["🔐 CỔNG ĐĂNG NHẬP & KIỂM SOÁT PHÂN QUYỀN"]:::core

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
`;

// Sequence 1: Auth & RBAC
const SEQ_AUTH = `
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
`;

// Sequence 2: Staff & Department
const SEQ_STAFF = `
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
`;

// Sequence 3: Check XML
const SEQ_XML = `
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
`;

// Sequence 4: Specialized Rules Engine
const SEQ_RULES = `
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
    end

    RuleEngine-->>UI: Trả về kết quả phân tích vi phạm chi tiết
    UI-->>GiamDinh: Hiển thị bảng tổng hợp hồ sơ nghi vấn xuất toán
    GiamDinh->>UI: Bấm "Xuất Excel Báo cáo chuyên đề"
    UI->>Export: Sinh file Excel gồm nhiều Sheet kèm công thức và định dạng màu
    Export-->>GiamDinh: Tải về máy tính file Excel báo cáo hoàn chỉnh
`;

// Sequence 5: IT Requests 1 Task Focus
const SEQ_IT = `
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
`;

// Sequence 6: Chat & Notification
const SEQ_NOTIF = `
sequenceDiagram
    autonumber
    actor KP as Khoa/Phòng
    actor KTV as Kỹ thuật viên CNTT
    participant UI_KP as Khung Chat Khoa
    participant UI_KTV as Màn hình KTV (useTickets Polling 5s)
    participant API_Msg as API Messages (/api/.../it-requests/[id]/messages)
    participant DB as CSDL PostgreSQL
    participant Push as Web Push Notification Engine

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
`;

// Sequence 7: Feedback QR Mobile
const SEQ_FEEDBACK = `
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
`;

// Sequence 8: Feature Doc Drawer
const SEQ_DOC = `
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
`;

// HR MASTER FLOW
const MASTER_HR_CHART = `
flowchart TD
    classDef m1 fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef m2 fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef m3 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef m4 fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;
    classDef m5 fill:#ffe4e6,stroke:#e11d48,stroke-width:2px;
    classDef m6 fill:#ffedd5,stroke:#ea580c,stroke-width:2px;
    classDef core fill:#ffffff,stroke:#0f172a,stroke-width:3px;

    HR["👥 PHÂN HỆ QUẢN TRỊ NHÂN SỰ TOÀN DIỆN (HRM)<br/>1.500 Cán bộ Nhân viên BVĐK Lạng Sơn"]:::core

    HR --> P1["1. Hồ sơ Nhân sự 360° & Hợp đồng"]:::m1
    HR --> P2["2. Phạm vi Hành nghề & Phân quyền Kỹ thuật"]:::m2
    HR --> P3["3. Đào tạo Liên tục (CME) & Bồi dưỡng"]:::m3
    HR --> P4["4. Phân ca & Chấm công Lâm sàng 24/24"]:::m4
    HR --> P5["5. Quản lý Nghỉ phép Trực tuyến Đa cấp"]:::m5
    HR --> P6["6. Tiền lương & Phụ cấp Phẫu thuật (QĐ 73)"]:::m6

    P1 --> DB[("🗄️ CƠ SỞ DỮ LIỆU POSTGRESQL (PRISMA)")]:::core
    P2 --> DB
    P3 --> DB
    P4 --> DB
    P5 --> DB
    P6 --> DB

    P2 -.-> BHYT["🛡️ Cảnh báo Chống Xuất toán BHYT (XML3)"]:::m3
`;

// HR 1: Privilege Scope
const SEQ_HR_PRIVILEGE = `
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
`;

// HR 2: Leave Online
const SEQ_HR_LEAVE = `
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
`;

// HR 3: CME
const SEQ_HR_CME = `
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
`;

// HR 4: Attendance 24/24
const SEQ_HR_ATTENDANCE = `
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
`;

// HR 5: Payroll QD 73
const SEQ_HR_PAYROLL = `
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
`;

export default function SystemArchitecturePage() {
    const [activeTab, setActiveTab] = useState('SYSTEM');

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            
            {/* Header Title Banner */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-6 text-white shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Architecture & Workflows
                            </span>
                            <span className="bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                                Version 2.5
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-white">
                            Sơ đồ Kiến trúc & Sequence Diagrams Tương tác
                        </h1>
                        <p className="text-blue-100 text-xs sm:text-sm mt-1 m-0">
                            Bệnh viện Đa khoa Lạng Sơn • Khám chữa bệnh BHYT & Quản trị Nhân sự (HRM)
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <a 
                            href="/htqlbenhvien/docs/so_do_tuong_tac_toan_he_thong.html" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-white text-blue-700 hover:bg-blue-50 text-xs font-semibold px-3 py-2 rounded-xl transition-all shadow-sm no-underline"
                        >
                            🌐 Mở Bản đồ HTML Độc lập
                        </a>
                    </div>
                </div>
            </div>

            {/* Main Tabs Container: Bắt buộc dùng type="card" theo quy chuẩn */}
            <Tabs
                type="card"
                activeKey={activeTab}
                onChange={setActiveTab}
                className="bg-transparent"
                items={[
                    {
                        key: 'SYSTEM',
                        label: (
                            <span className="flex items-center gap-1.5 font-semibold px-2">
                                <DeploymentUnitOutlined className="text-blue-600" />
                                <span>1. Toàn bộ Hệ thống HTQLBV</span>
                            </span>
                        ),
                        children: (
                            <div className="space-y-6 pt-2">
                                {/* Sơ đồ tổng thể */}
                                <Card 
                                    title={
                                        <div className="flex items-center gap-2 text-slate-800">
                                            <ApartmentOutlined className="text-blue-600" />
                                            <span className="font-bold">Sơ đồ Luồng Tổng thể Toàn Hệ thống (Master Flow)</span>
                                        </div>
                                    }
                                    className="rounded-2xl shadow-xs border-slate-200"
                                >
                                    <Alert
                                        type="info"
                                        showIcon
                                        message="Kiến trúc đồng bộ xuyên suốt"
                                        description="Hệ thống kết nối liên thông: Đăng nhập phân quyền RBAC -> Nghiệp vụ Nhân sự -> Bóc tách hồ sơ BHYT QĐ 130 -> Động cơ Chuyên đề -> Hỗ trợ Kỹ thuật 1 việc -> Thông báo Real-time -> Hòm thư QR Mobile."
                                        className="mb-4 rounded-xl text-xs"
                                    />
                                    <MermaidViewer chart={MASTER_SYSTEM_CHART} id="master-system" />
                                </Card>

                                {/* Danh sách 8 Sequence diagrams chi tiết */}
                                <Card 
                                    title={<span className="font-bold text-slate-800">8 Biểu đồ Trình tự (Sequence Diagrams) Chi tiết Từng Phân hệ</span>}
                                    className="rounded-2xl shadow-xs border-slate-200"
                                >
                                    <Collapse 
                                        defaultActiveKey={['seq-1', 'seq-5']}
                                        className="bg-transparent border-none space-y-3"
                                        items={[
                                            {
                                                key: 'seq-1',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <SafetyCertificateOutlined className="text-sky-600" />
                                                        <span>1. Xác thực Đăng nhập & Ma trận Phân quyền Đa cấp độ (Auth & RBAC)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_AUTH} id="seq-auth" />
                                            },
                                            {
                                                key: 'seq-2',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <TeamOutlined className="text-amber-600" />
                                                        <span>2. Quản lý Nhân sự, Khoa Phòng & Chứng chỉ Hành nghề (Staff & Department)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_STAFF} id="seq-staff" />
                                            },
                                            {
                                                key: 'seq-3',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <FileTextOutlined className="text-emerald-600" />
                                                        <span>3. Bóc tách & Kiểm tra Hồ sơ XML BHYT theo QĐ 130/QĐ-BYT (Check XML)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_XML} id="seq-xml" />
                                            },
                                            {
                                                key: 'seq-4',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <ThunderboltOutlined className="text-green-700" />
                                                        <span>4. Động cơ Kiểm tra Chuyên đề Trùng lặp BHYT (Specialized Rules Engine)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_RULES} id="seq-rules" />
                                            },
                                            {
                                                key: 'seq-5',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <ApartmentOutlined className="text-purple-600" />
                                                        <span>5. Quản lý Yêu cầu Kỹ thuật & Tiếp nhận 1 Việc Tập trung (IT Requests)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_IT} id="seq-it" />
                                            },
                                            {
                                                key: 'seq-6',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <ClockCircleOutlined className="text-orange-600" />
                                                        <span>6. Hệ thống Chat Đa kênh & Cảnh báo Thời gian thực (Real-time Notification)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_NOTIF} id="seq-notif" />
                                            },
                                            {
                                                key: 'seq-7',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <AuditOutlined className="text-rose-600" />
                                                        <span>7. Hòm thư Góp ý 3 Kênh & Khảo sát Người bệnh qua QR Mobile (Feedback)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_FEEDBACK} id="seq-feedback" />
                                            },
                                            {
                                                key: 'seq-8',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <BookOutlined className="text-slate-600" />
                                                        <span>8. Tủ sách Hướng dẫn Sử dụng & Quản lý Thay đổi (FeatureDocDrawer)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_DOC} id="seq-doc" />
                                            }
                                        ]}
                                    />
                                </Card>
                            </div>
                        )
                    },
                    {
                        key: 'HRM',
                        label: (
                            <span className="flex items-center gap-1.5 font-semibold px-2">
                                <TeamOutlined className="text-indigo-600" />
                                <span>2. Phân hệ Quản trị Nhân sự (HRM - 1.500 Nhân sự)</span>
                            </span>
                        ),
                        children: (
                            <div className="space-y-6 pt-2">
                                {/* Sơ đồ tổng thể HRM */}
                                <Card 
                                    title={
                                        <div className="flex items-center gap-2 text-slate-800">
                                            <TeamOutlined className="text-indigo-600" />
                                            <span className="font-bold">Kiến trúc 6 Module Quản trị Nhân sự Chuyên sâu Y tế</span>
                                        </div>
                                    }
                                    className="rounded-2xl shadow-xs border-slate-200"
                                >
                                    <Alert
                                        type="success"
                                        showIcon
                                        message="Đáp ứng hoàn hảo quy mô 1.500 Cán bộ Nhân viên"
                                        description="Hệ thống xây dựng theo Luật Khám bệnh, chữa bệnh 15/2023/QH15 và NĐ 96/2023/NĐ-CP: Quản lý CCHN, Phân quyền kỹ thuật chống xuất toán BHYT, Đào tạo CME, Chấm công ca kíp 24/24, Nghỉ phép online và Lương phụ cấp ca mổ QĐ 73."
                                        className="mb-4 rounded-xl text-xs"
                                    />
                                    <MermaidViewer chart={MASTER_HR_CHART} id="master-hr" />
                                </Card>

                                {/* 5 Sequence diagrams chi tiết HRM */}
                                <Card 
                                    title={<span className="font-bold text-slate-800">5 Biểu đồ Trình tự Nghiệp vụ Y tế Cốt lõi</span>}
                                    className="rounded-2xl shadow-xs border-slate-200"
                                >
                                    <Collapse 
                                        defaultActiveKey={['hr-1', 'hr-2']}
                                        className="bg-transparent border-none space-y-3"
                                        items={[
                                            {
                                                key: 'hr-1',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <SafetyCertificateOutlined className="text-amber-600" />
                                                        <span>1. Quản lý Phạm vi Hành nghề & Phân quyền Kỹ thuật (Chống xuất toán BHYT)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_HR_PRIVILEGE} id="seq-hr-privilege" />
                                            },
                                            {
                                                key: 'hr-2',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <ClockCircleOutlined className="text-rose-600" />
                                                        <span>2. Quy trình Nộp & Phê duyệt Đơn Nghỉ phép Trực tuyến Đa cấp</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_HR_LEAVE} id="seq-hr-leave" />
                                            },
                                            {
                                                key: 'hr-3',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <BookOutlined className="text-emerald-600" />
                                                        <span>3. Quy trình Đào tạo Y khoa Liên tục (CME) & Bồi dưỡng Chuyên môn</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_HR_CME} id="seq-hr-cme" />
                                            },
                                            {
                                                key: 'hr-4',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <ClockCircleOutlined className="text-purple-600" />
                                                        <span>4. Quy trình Chấm công Phân ca Lâm sàng & Kíp trực 24/24</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_HR_ATTENDANCE} id="seq-hr-attendance" />
                                            },
                                            {
                                                key: 'hr-5',
                                                label: (
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                                        <DollarCircleOutlined className="text-orange-600" />
                                                        <span>5. Quy trình Tính Lương Ngạch bậc & Phụ cấp Phẫu thuật - Thủ thuật (QĐ 73/2011)</span>
                                                    </div>
                                                ),
                                                children: <MermaidViewer chart={SEQ_HR_PAYROLL} id="seq-hr-payroll" />
                                            }
                                        ]}
                                    />
                                </Card>

                                {/* Kế hoạch triển khai độc lập 6 Module */}
                                <Card 
                                    title={<span className="font-bold text-slate-800">Lộ trình Kế hoạch Triển khai Riêng cho Từng Module</span>}
                                    className="rounded-2xl shadow-xs border-slate-200"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <div className="flex items-center justify-between mb-1">
                                                <Tag color="blue">Tuần 1 - 2</Tag>
                                                <span className="text-xs font-bold text-slate-400">Module 1</span>
                                            </div>
                                            <h4 className="font-bold text-sm text-slate-800 m-0">Hồ sơ Nhân sự 360°</h4>
                                            <p className="text-xs text-slate-500 mt-1 m-0">Quản lý 1.500 hồ sơ, hợp đồng lao động, quá trình công tác, nhắc hạn nâng lương.</p>
                                        </div>

                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <div className="flex items-center justify-between mb-1">
                                                <Tag color="gold">Tuần 2 - 3</Tag>
                                                <span className="text-xs font-bold text-slate-400">Module 2</span>
                                            </div>
                                            <h4 className="font-bold text-sm text-slate-800 m-0">Phạm vi Hành nghề (CCHN)</h4>
                                            <p className="text-xs text-slate-500 mt-1 m-0">Phê duyệt kỹ thuật độc lập/giám sát, liên thông chống xuất toán BHYT XML3.</p>
                                        </div>

                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <div className="flex items-center justify-between mb-1">
                                                <Tag color="green">Tuần 3 - 4</Tag>
                                                <span className="text-xs font-bold text-slate-400">Module 3</span>
                                            </div>
                                            <h4 className="font-bold text-sm text-slate-800 m-0">Đào tạo Liên tục CME</h4>
                                            <p className="text-xs text-slate-500 mt-1 m-0">Theo dõi tích lũy số giờ/tín chỉ CME hàng năm của từng Bác sĩ, Điều dưỡng.</p>
                                        </div>

                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <div className="flex items-center justify-between mb-1">
                                                <Tag color="purple">Tuần 4 - 5</Tag>
                                                <span className="text-xs font-bold text-slate-400">Module 4</span>
                                            </div>
                                            <h4 className="font-bold text-sm text-slate-800 m-0">Chấm công Ca trực 24/24</h4>
                                            <p className="text-xs text-slate-500 mt-1 m-0">Kết nối máy chấm công vân tay, đối chiếu lịch trực lâm sàng, tổng hợp công tháng.</p>
                                        </div>

                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <div className="flex items-center justify-between mb-1">
                                                <Tag color="magenta">Tuần 5 - 6</Tag>
                                                <span className="text-xs font-bold text-slate-400">Module 5</span>
                                            </div>
                                            <h4 className="font-bold text-sm text-slate-800 m-0">Nghỉ phép Trực tuyến</h4>
                                            <p className="text-xs text-slate-500 mt-1 m-0">Nộp đơn online, duyệt đa cấp Trưởng khoa &rarr; TCCB, tự động trừ quỹ phép năm.</p>
                                        </div>

                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <div className="flex items-center justify-between mb-1">
                                                <Tag color="orange">Tuần 6 - 7</Tag>
                                                <span className="text-xs font-bold text-slate-400">Module 6</span>
                                            </div>
                                            <h4 className="font-bold text-sm text-slate-800 m-0">Lương & Phụ cấp QĐ 73</h4>
                                            <p className="text-xs text-slate-500 mt-1 m-0">Tính tự động phụ cấp ca mổ theo QĐ 73, lương ngạch bậc, phiếu lương điện tử.</p>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )
                    }
                ]}
            />
        </div>
    );
}
