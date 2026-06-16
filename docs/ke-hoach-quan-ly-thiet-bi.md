# Kế hoạch chi tiết: Hệ thống Quản lý Thiết bị Bệnh viện

## 1. Mục tiêu dự án
Xây dựng một hệ thống phần mềm tập trung để quản lý vòng đời của tất cả các loại tài sản, thiết bị trong bệnh viện, được phân quyền và quản lý bởi 3 phòng ban chức năng chính:
- **Phòng CNTT:** Quản lý máy tính, máy in, server, thiết bị mạng, phần mềm...
- **Phòng Vật tư thiết bị Y tế:** Quản lý máy siêu âm, X-quang, máy đo huyết áp, giường bệnh...
- **Phòng Hành chính quản trị:** Quản lý bàn ghế, tủ tài liệu, điều hòa, quạt, xe cứu thương...

## 2. Phạm vi hệ thống (Scope)
Hệ thống sẽ phục vụ các quy trình cốt lõi sau:
- **Nhập/Xuất kho:** Quản lý thông qua các **Phiếu nhập kho** và **Phiếu xuất kho** chuẩn hóa. Ghi nhận thiết bị mới mua, phân bổ bàn giao về các khoa/phòng.
- **Theo dõi vị trí & Trạng thái:** Nắm bắt chính xác thiết bị đang ở khoa nào, do ai chịu trách nhiệm, tình trạng hiện tại (Chưa sử dụng, Đang sử dụng, Báo hỏng, Đang sửa chữa, Đã thanh lý).
- **Bảo trì & Sửa chữa:** Theo dõi lịch sử sửa chữa, chi phí, và lên lịch bảo trì định kỳ.
- **Thống kê & Báo cáo:** Cung cấp **Báo cáo Nhập - Xuất - Tồn**, báo cáo tổng tài sản, báo cáo khấu hao, thiết bị hư hỏng theo từng phòng ban quản lý chuyên trách.

## 3. Xác thực & Phân quyền (Authentication & Authorization)
Hệ thống sử dụng mô hình kết hợp giữa **RBAC** (Quyền theo chức danh) và **ABAC** (Quyền theo phạm vi dữ liệu) để giải quyết triệt để việc 3 phòng ban dùng chung một phần mềm nhưng độc lập về mặt quản lý.

**3.1. Cấu trúc Database liên quan Auth:**
- Bảng `Role`: Định nghĩa các nhóm quyền và danh sách menu được phép truy cập (permissions JSON). Các code Role dự kiến: `ADMIN`, `CNTT`, `KHOA`.
- Bảng `User`: Lưu thông tin đăng nhập. Các trường quan trọng phục vụ phân quyền dữ liệu (ABAC) là: `role` và `ma_khoa` (Khóa ngoại trỏ về bảng Department).

**3.2. Luồng nghiệp vụ Phân quyền (Authorization Logic):**
- **Quyền chức năng (Ai được làm gì?):**
  - **`SUPER_ADMIN` (Ban Giám Đốc):** Có quyền tối cao, xem mọi báo cáo tổng hợp.
  - **`MANAGER` (Nhân sự 3 phòng CNTT, VTYT, HCQT):** Được quyền quản trị Danh mục, Thêm/Sửa/Xóa Thiết bị, Lập Phiếu Nhập/Xuất kho và Duyệt yêu cầu.
  - **`CLINICAL_USER` (Trưởng khoa/Điều dưỡng trưởng):** Chỉ có quyền Xem danh sách tài sản, Lập Phiếu Yêu Cầu (Mượn/Trả/Sửa chữa). KHÔNG có quyền tạo mới thiết bị.

- **Quyền phạm vi dữ liệu (Ai được thấy data nào? - Mấu chốt hệ thống):**
  - Khi truy xuất API, hệ thống tự động lọc (filter) data dựa vào `ma_khoa` của User đang login.
  - **Ví dụ 1 (Phòng Quản lý):** User thuộc "Phòng CNTT" đăng nhập -> API chỉ trả về các thiết bị thuộc phân loại Tin học. Quản trị viên CNTT không thể nhìn thấy hay can thiệp vào máy siêu âm của phòng VTYT.
  - **Ví dụ 2 (Khoa Lâm sàng):** Điều dưỡng "Khoa Nội" đăng nhập -> Hệ thống chỉ hiển thị những thiết bị đang có vị trí lưu trữ tại "Kho Khoa Nội".

## 4. Cấu trúc dữ liệu dự kiến (Data Schema)
**1. Bảng `Department` (Danh mục Khoa/Phòng):**
- Bảng danh mục quản lý toàn bộ các Khoa và Phòng ban trong bệnh viện.
- `ma_khoa` (Khóa chính - Mã khoa/phòng), `ten_khoa` (Tên khoa/phòng).
- Cần bổ sung thêm trường `type` (Phân loại: Phòng chức năng quản lý hay Khoa lâm sàng).

**2. Bảng `Warehouses` (Danh mục Kho):**
- Khớp với giao diện "Thông tin kho". Khi khai báo, bắt buộc chọn Kho thuộc Khoa/Phòng nào.
- `id`, `code` (Mã kho), `name` (Tên kho).
- `department_id` (Khóa ngoại nối với bảng `Department` thông qua `ma_khoa`).
- `warehouse_type` (Loại kho).
- `room` (Phòng vật lý đặt kho).
- `storekeeper_id` (Thủ kho - Nối với bảng `Staff` / Nhân viên).
- `status` (Trạng thái: Hoạt động / Ngừng hoạt động).

**3. Bảng `Equipment_Categories` (Danh mục loại dùng chung):**
- Đây là bảng danh mục DÙNG CHUNG cho cả 3 bộ phận, nhưng có trường phân loại để biết danh mục này thuộc bộ phận nào quản lý.
- `id`, `name`, `managed_by` (Phân loại danh mục thuộc: CNTT, VTYT, hay HCQT).

**4. Danh mục tham chiếu dùng chung (`SystemCategory`):**
- Hệ thống sử dụng bảng `SystemCategory` làm danh mục tập trung thay vì tạo nhiều bảng rời rạc.
- Sử dụng trường `type` để phân loại: `HANG_SAN_XUAT`, `NUOC_SAN_XUAT`, `NGUON_KINH_PHI`, `NHOM_THIET_BI`, `LOAI_THIET_BI`...
- Việc này giúp tận dụng giao diện quản lý danh mục (System Categories) đã có sẵn trong project và giảm thiểu việc tạo bảng mới dư thừa.

**5. Bảng `Equipments` (Danh sách thiết bị/Tài sản cụ thể):**
- Khi import dữ liệu, hệ thống tự động map theo file Excel chuẩn, đồng thời **TỰ ĐỘNG SINH RA 1 MÃ QR CODE** (`qr_code`).
- **Các trường cơ bản (map theo Excel):**
  - `ma_vttb` (Mã TB), `ten_vttb` (Tên TB), `qr_code` (Mã QR sinh tự động).
  - `manufacturer_id` (ID Hãng SX), `country_id` (ID Nước SX), `production_year_id` (ID Năm SX).
  - `category_id` (Map từ cột `loai_thietbi` sang bảng `Equipment_Categories`).
  - `group_id` (Nối với bảng Nhóm thiết bị), `type_id` (Nối với bảng Loại thiết bị).
  - `donvitinh`, `vattu_hay_tb` (Thông tin phân loại khác).
  - `kyhieu` (Model), `serial`, `quanly_serial` (Thông tin định danh).
  - `dongia`, `vat`, `dongia_vat` (Tài chính).
  - `funding_source_id` (ID Nguồn kinh phí), `dv_cungung` (Nhà cung cấp).
  - `bao_hanh`, `ngay_bdbh`, `ngay_ktbh` (Thông tin bảo hành).
  - `pp_tinh_khauhao`, `thoigian_khauhao`, `ten_ketoan` (Khấu hao).
- **Các trường quản lý luồng:**
  - `tt_hoatdong` / `status` (Trạng thái: Đang hoạt động, Trong kho, Báo hỏng, Thanh lý...).
  - `warehouse_id` (Thiết bị đang nằm ở kho nào - Kho chính hay Kho khoa).
- **Trường dữ liệu Động (Dynamic Attributes):**
  - `custom_fields` (Kiểu dữ liệu JSON/JSONB): Nơi lưu trữ các trường dữ liệu do người dùng tự Add/Xóa qua giao diện (cho phép hệ thống linh hoạt mở rộng mà không cần sửa Database).

**6. Bảng `Inventory_Vouchers` (Phiếu Nhập/Xuất kho - Header):**
- Khớp với Form thông tin chung trên giao diện.
- `id`, `voucher_code` (Mã phiếu), `type` (Nhập kho / Xuất kho).
- `warehouse_id` (Kho lập phiếu), `date` (Ngày lập).
- `document_number` (Số chứng từ), `document_date` (Ngày chứng từ).
- `deliverer_name` (Người giao), `deliverer_address` (Địa chỉ), `received_date` (Ngày nhận mua).
- `created_by` (Người lập phiếu).

**7. Bảng `Inventory_Voucher_Details` (Chi tiết Phiếu - Lưới danh sách):**
- Lưu danh sách các lô thiết bị được add vào lưới (Grid) trước khi lưu.
- `id`, `voucher_id` (Nối với Phiếu ở trên).
- `category_id`, `group_id`, `type_id`, `ten_vttb` (Tên thiết bị).
- `quantity` (Số lượng nhập).
- `dongia`, `vat`, `dongia_vat`, `thanh_tien`.
- *(Và các thông tin chi tiết khác: hãng SX, nước SX, ngày bảo hành... nhập chung cho lô này).*
- **Logic cực kỳ quan trọng:** Khi bấm "Nhập kho", hệ thống duyệt qua bảng chi tiết này. Nếu `quantity = 10`, hệ thống sẽ **insert 10 dòng** vào bảng `Equipments` và tự động sinh 10 mã QR code khác nhau.

**8. Bảng `Maintenance_Logs` (Lịch sử bảo trì/Sửa chữa):**
- `id`, `equipment_id`, `reported_by` (Khoa báo hỏng), `issue_description`.
- `handled_by` (Người sửa), `status` (Chờ xử lý, Đang sửa, Hoàn thành), `cost`.

## 5. Luồng xử lý nghiệp vụ chính (Business Logic) & UI/UX

**Quy tắc Giao diện (UI/UX Rules theo định hướng Ant Design):**
- **Cấu hình Trường dữ liệu động (Dynamic Fields & Table Links):** 
  - Sử dụng sức mạnh của **Ant Design `Form` (Dynamic Form Items)** để cho phép Admin tự do **Thêm/Xóa các trường dữ liệu (fields)** trực tiếp trên UI (Form Builder). 
  - Móc nối (link) các Table với nhau thông qua API và render bằng component **Ant Design `Select`** (fetch options động từ database).
- **Cascading Dropdown (Lọc dữ liệu liên kết):** 
  - Áp dụng component **Ant Design `Select`** có liên kết dữ liệu. Khi chọn Nhóm = "Nhóm Thiết bị tin học", sự kiện `onChange` sẽ gọi API để cập nhật danh sách cho Select "Loại thiết bị" (chỉ hiện Máy tính, Máy in).
- **Master-Detail Form (Màn hình Nhập kho):**
  - Cấu trúc giao diện cực mạnh nhờ **Ant Design `Form.List`** kết hợp với **Editable `Table`**, cho phép thêm/sửa/xóa trực tiếp nhiều dòng thiết bị trước khi submit Lưu phiếu.

**Luồng 1: Quy trình Nhập/Xuất/Luân chuyển kho bằng Phiếu**
1. **Nhập kho chính (Mua mới):** Quản trị viên phòng (VD: VTYT) lập **Phiếu Nhập Kho**.
   - Khai báo danh sách thiết bị. Ngay khi lưu duyệt, hệ thống tự động sinh ra **Mã QR Code** cho từng thiết bị. Trạng thái thiết bị: `Trong kho`.
2. **Xuất kho (Kho chính -> Khoa):**
   - **Hình thức 1 (Có duyệt):** Khoa/Phòng lập **Phiếu Yêu Cầu Xuất**. Kho chính **Duyệt** -> Hệ thống sinh ra **Phiếu Xuất Kho**.
   - **Hình thức 2 (Trực tiếp):** Kho chính tự lập **Phiếu Xuất Kho** để cấp phát thẳng về Khoa.
3. **Trả thiết bị (Khoa -> Kho chính):**
   - Khi không còn nhu cầu hoặc thiết bị hỏng, Khoa/Phòng lập **Phiếu Trả Thiết Bị** gửi về Kho chính.
   - Kho chính xác nhận nhận lại. Trạng thái thiết bị đổi từ `Đang sử dụng` về lại `Trong kho` hoặc `Chờ thanh lý`.
4. **Mượn/Luân chuyển nội bộ (Khoa <-> Khoa):**
   - **Khoa mượn** (VD: Khoa Nội) chủ động lập **Phiếu Yêu Cầu Mượn** gửi đến Khoa cho mượn (VD: Khoa Hồi sức).
   - **Khoa cho mượn** nhận được thông báo, kiểm tra thiết bị và nhấn **Duyệt**.
   - Chỉ khi được Khoa cho mượn duyệt, hệ thống mới chính thức ghi nhận việc luân chuyển và tự động cập nhật vị trí thiết bị.
5. **Cập nhật vị trí tự động:** Bất kỳ chứng từ nào (Xuất/Trả/Mượn) được duyệt, hệ thống lập tức tự động cập nhật `warehouse_id` (Vị trí Kho) và `status` (Trạng thái) của thiết bị đó.

**Luồng 2: Báo cáo Nhập - Xuất - Tồn**
- Quản trị viên chọn mốc thời gian (VD: Tháng 5) để xem báo cáo tự động:
  - **Tồn đầu kỳ:** Số lượng thiết bị loại X trong kho ở đầu kỳ.
  - **Nhập trong kỳ:** Số lượng thiết bị loại X mua mới (dựa vào tổng Phiếu nhập).
  - **Xuất trong kỳ:** Số lượng thiết bị loại X cấp cho các khoa (dựa vào tổng Phiếu xuất).
  - **Tồn cuối kỳ:** Tồn đầu kỳ + Nhập - Xuất (Số lượng còn lại thực tế trong kho).

**Luồng 3: Quy trình Báo hỏng - Sửa chữa liên phòng ban**
1. Điều dưỡng khoa Nội phát hiện 1 máy tính hỏng và 1 máy đo huyết áp hỏng.
2. Lên phần mềm tạo 2 "Yêu cầu sửa chữa".
3. Hệ thống tự động phân loại: 
   - Máy tính -> Báo thông báo cho nhân sự phòng CNTT.
   - Máy đo huyết áp -> Báo thông báo cho nhân sự phòng Vật tư Y tế.
4. Nhân viên kỹ thuật của từng phòng tiếp nhận, chuyển trạng thái sang "Đang sửa".
5. Sau khi sửa xong, cập nhật chi phí, ghi chú, trạng thái thành "Đang sử dụng" -> Khoa Nội nhận được thông báo đã sửa xong.

## 6. Công nghệ sử dụng (Tech Stack)
Dự án được xây dựng trên hệ sinh thái Javascript/Typescript hiện đại, mạnh mẽ và ổn định cho môi trường doanh nghiệp:
- **Database:** PostgreSQL (Hỗ trợ truy vấn cực mạnh, đặc biệt tối ưu cho kiểu dữ liệu JSONB của Dynamic Form).
- **Nền tảng & Framework:** Node.js, Next.js (App Router, Fullstack React Framework).
- **ORM / Database Access:** Prisma ORM (Tương tác database an toàn, tự động sinh type).
- **UI Components:** Ant Design (AntD) - Cung cấp sẵn hệ thống Table, Form, Modal cực kỳ chuẩn xác.
- **Styling:** Tailwind CSS (Custom UI, layout linh hoạt, bổ trợ cho AntD).

## 7. Giai đoạn triển khai dự kiến
**Giai đoạn 1 (Nền tảng):**
- Setup base project (Next.js + Prisma + Tailwind + Ant Design).
- Xây dựng database schema (Prisma schema), API CRUD cơ bản.
- Giao diện quản lý các Danh mục tham chiếu (Kho, Khoa/Phòng, Nhóm, Loại...).

**Giai đoạn 2 (Core Business):**
- Giao diện Master-Detail cho Phiếu Nhập Kho (sử dụng Form.List của AntD).
- Xử lý logic tự động sinh QR Code và nhân bản dòng thiết bị.
- Tính năng Phiếu xuất và luân chuyển thiết bị.

**Giai đoạn 3 (Nâng cao):**
- Form Builder động (Thêm/xóa field) sử dụng JSONB.
- Hệ thống báo cáo tổng hợp (Nhập-Xuất-Tồn, Khấu hao).
