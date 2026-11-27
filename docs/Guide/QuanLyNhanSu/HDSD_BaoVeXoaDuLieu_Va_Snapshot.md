# HƯỚNG DẪN HỆ THỐNG BẢO VỆ XÓA DỮ LIỆU & TỰ ĐỘNG SNAPSHOT JSON (ĐỢT 1 – 2 – 3)

## 1. Mục đích & Cơ chế bảo vệ đa tầng
Hệ thống bảo vệ xóa dữ liệu được chuẩn hóa theo nguyên tắc vận hành thực tế: **loại bỏ nút "Xóa tất cả / Xóa toàn bộ" khỏi các màn hình dữ liệu chính**, bắt buộc người dùng **tick checkbox (`checked`) mới cho xóa**, đồng thời kết hợp bảo vệ đa tầng ở Backend & tự động chụp Snapshot JSON dự phòng.

### 1.1. Ba tầng cảnh báo & kiểm soát trên Giao diện (UI)
1. **Nguyên tắc Checkbox bắt buộc (`Xóa đã chọn (N)`)**:
   - Các bảng dữ liệu chính (`Nhân sự`, `Khoa/Phòng`, `Mẫu 01–06`, `Phạm vi chuyên môn`, `Lịch sử Dịch vụ Bác sĩ`, `Hồ sơ đã gửi`, `Tra cứu XML1`) đã bỏ nút Xóa tất cả/Xóa toàn bộ, chỉ mở nút xóa khi có ít nhất 1 dòng được tick checkbox (`selectedRowKeys.length > 0`), đi kèm `Popconfirm` / `Modal.confirm` xác nhận.
2. **Tầng Cam (`Popconfirm` / `Modal.confirm`)**:
   - Áp dụng cho xóa các dòng đã chọn theo checkbox, xóa lịch trực 1 ngày/1 khoa tại `/clinical-scheduling/saved-schedules` (giữ nguyên nút `Xóa tất cả (Reset)` theo nghiệp vụ xếp lịch ngày), hoặc xóa bản ghi nghiệp vụ quan trọng.
3. **Tầng Vàng (`Popconfirm`)**:
   - Áp dụng cho các nút xóa quy tắc kiểm tra Excel ([excel-checker/builder](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/excel-checker/builder/page.tsx)), trường dữ liệu trong trình sửa Form động ([dynamic-forms/edit](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/dynamic-forms/%5Bid%5D/edit/page.tsx)) và trường tự tạo trong [DynamicForm.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/components/shared/DynamicForm.tsx).
4. **Hộp thoại Đỏ dùng chung ([DangerConfirmModal.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/components/common/DangerConfirmModal.tsx))**:
   - Sẵn sàng tái sử dụng cho các tác vụ đặc biệt có mức độ rủi ro cao (bắt buộc tick cam kết + gõ `XOA TAT CA`).

### 1.2. Lớp Backend (`authorizeApiRequest`, xác nhận tường minh & `$transaction`)
- Dùng các hàm dùng chung trong [deleteProtection.ts](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/lib/deleteProtection.ts):
  - **`authorizeApiRequest`**: Kiểm tra JWT session, chặn hoàn toàn request chưa đăng nhập (`401`) và tài khoản `GUEST` (`403`). Phân quyền theo `ADMIN`, danh sách `allowedRoles`, `menuKeys` (`Role.permissions`), hoặc `allowAuthenticated` tùy phạm vi từng module để **không làm gián đoạn luồng chạy hiện tại (Zero Regression)**.
  - **`parseDeleteIdsFromRequest`**: Trích xuất danh sách `ids` hợp lệ từ cả query `?ids=...` lẫn JSON body `{ ids: [...] }`.
  - **Phòng vệ sâu trên API**: Dù giao diện đã bỏ nút `Xóa tất cả`, Backend vẫn khóa chặt các nhánh `deleteAll` / `confirmDeleteAll=true` ở tầng API để chặn gọi trực tiếp từ script hoặc công cụ ngoài; chặn payload rỗng kích hoạt xóa toàn bảng (như `ids: []`, `ma_pham_vi_list: []`, `POST /api/rules` mảng rỗng `[]`).
  - **Ràng buộc dữ liệu liên kết**: Chặn xóa Khoa/Phòng còn Nhân sự/Kho; chặn xóa Phạm vi chuyên môn hoặc Nhóm TT32 nếu vẫn còn CCHN đang tham chiếu.
  - **Giao dịch nguyên tử (`$transaction`)**: Gộp bước `createDeleteSnapshot` → `deleteMany` (hoặc `deleteMany` → `createMany` khi đồng bộ/ghi đè danh mục) trong cùng transaction.

### 1.3. Lớp Tự động Snapshot JSON (`DataDeleteSnapshot`)
- Trước khi xóa theo danh sách checkbox (`BULK_DELETE`), xóa lịch ngày, hoặc đồng bộ ghi đè (`SYNC_OVERWRITE`), dữ liệu gốc được đóng gói JSON và nén bằng `zlib.gzipSync`, lưu trực tiếp vào bảng PostgreSQL `DataDeleteSnapshot` (lưu bền vững trong Docker volume `htql-prod-data`).
- Giới hạn an toàn chống quá tải bộ nhớ (`SnapshotLimitError`): tối đa **`15.000` bản ghi** và tối đa **`10 MB` dữ liệu nén (`gzip`)** mỗi Snapshot.

---

## 2. Database Model mới (`DataDeleteSnapshot`)
Khai báo trong [schema.prisma](file:///d:/1.ProjectBVDKLS/htqlbenhvien/prisma/schema.prisma):

| Trường | Kiểu | Mô tả |
| :--- | :--- | :--- |
| `id` | `String (cuid)` | Khóa chính |
| `tableName` | `String` | Tên bảng/nhóm dữ liệu |
| `displayName` | `String` | Tên hiển thị tiếng Việt của bản sao lưu |
| `actionType` | `String` | `DELETE_ALL`, `BULK_DELETE`, `SYNC_OVERWRITE` |
| `filterSummary` | `String?` | Phạm vi/điều kiện lọc lúc xóa |
| `recordCount` | `Int` | Tổng số bản ghi trong snapshot |
| `rawSizeBytes` | `Int` | Dung lượng JSON gốc trước khi nén |
| `payloadGzip` | `Bytes` | Dữ liệu JSON đã nén `gzip` |
| `restorable` | `Boolean` | `true` nếu hỗ trợ khôi phục tự động trên web; `false` nếu chỉ tải JSON |
| `deletedById`, `deletedByName`, `deletedByRole` | `String?` | Người thực hiện thao tác xóa |
| `restoredAt`, `restoredByName` | `DateTime?`, `String?` | Thời điểm & người khôi phục gần nhất |
| `createdAt` | `DateTime` | Thời điểm tạo Snapshot |

---

## 3. Tổng hợp các Module đã bảo vệ theo 3 Đợt

### 3.1. Đợt 1 — Nhân sự, CCHN & Dữ liệu lõi
- **Nhân sự ([staff/page.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/staff/page.tsx), [api/staff/route.ts](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/api/staff/route.ts))**: Bỏ nút `Xóa tất cả`; bắt buộc tick checkbox mới bật nút **`Xóa đã chọn (N)`** (`Popconfirm`), tự động Snapshot trọn bộ `Staff` kèm `PracticingCertificate`, `CCHNScopeMapping`, `StaffTraining`, `StaffWorkHistory` (`restorable: true`), có nút **Snapshot** cho `ADMIN`.
- **Đồng bộ Mẫu 02 ([api/staff/sync-mau02/route.ts](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/api/staff/sync-mau02/route.ts))**: Phân quyền `ADMIN/PTCCB/TCCB/CNTT` + menu; bọc `$transaction`, tự động Snapshot `Mau02Catalog` cũ trước khi xóa-tạo mới (`SYNC_OVERWRITE`).
- **Chứng chỉ hành nghề ([api/practicing-certificates/route.ts](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/api/practicing-certificates/route.ts))**: Phân quyền `DELETE` theo vai trò/menu hoặc cùng `ma_khoa`.
- **Phạm vi chuyên môn ([pham-vi-chuyen-mon/page.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/pham-vi-chuyen-mon/page.tsx))**: Bỏ nút `Xóa toàn bộ gán Dịch vụ`; chỉ xóa mapping khi tick checkbox chọn Phạm vi; chặn xóa nếu CCHN còn liên kết; Snapshot `ScopeOfPracticeCatalog` / `ScopeServiceMapping`.
- **Khoa / Phòng ([departments/page.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/departments/page.tsx))**: Bỏ nút `Xóa tất cả`; thêm checkbox `rowSelection` + nút **`Xóa đã chọn (N)`**, kiểm tra chặn nếu còn Nhân sự/Kho + Snapshot `Department`.
- **Nhóm TT32 ([tt32/page.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/tt32/page.tsx))**: Phân quyền `ADMIN`/`MENU_TT32`; chặn xóa nếu CCHN còn tham chiếu `tt32_category_id`.
- **Lịch sử dịch vụ bác sĩ ([staff/quan-ly-lich-su-dich-vu](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/staff/quan-ly-lich-su-dich-vu/page.tsx), [admin/nhansu/quan-ly-lich-su-dich-vu](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/admin/nhansu/quan-ly-lich-su-dich-vu/page.tsx))**: Bỏ nút `Xóa toàn bộ dữ liệu`; thêm checkbox `rowSelection` + nút **`Xóa đã chọn (N)`** + Snapshot `DoctorServiceMapping`.

### 3.2. Đợt 2 — Danh mục Mẫu BHYT, Quy tắc XML, XML1 & Yêu cầu Sự cố
- **Danh mục Mẫu 01–06 (`/mau01-catalog` .. `/mau06-catalog`)**:
  - Bỏ nút `Xóa toàn bộ` ở cả 6 màn hình; chỉ cho phép **`Xóa đã chọn (N)`** khi đã tick checkbox (kèm `Popconfirm` + Snapshot tự động `DepartmentCatalog`, `Mau02Catalog`..`Mau06Catalog`).
  - Mẫu 01 `POST` đồng bộ ghi đè tự động Snapshot bản cũ trong `$transaction`; Mẫu 06 chặn `{ ids: [] }` kích hoạt xóa toàn bảng.
- **Quy tắc kiểm tra XML (`/api/rules`)**: Chặn gửi mảng rỗng `[]` ghi đè xóa toàn bộ bảng khi DB đã có rule (giữ nguyên khởi tạo `DEFAULT_RULES` khi DB trống); tự động Snapshot `ValidationRule` nếu số quy tắc giảm.
- **Hồ sơ đã gửi ([chuyen-de/ho-so-da-gui/page.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/chuyen-de/ho-so-da-gui/page.tsx))**: Bỏ nút `Xóa toàn bộ (theo bộ lọc)`; chỉ giữ **`Xóa đã chọn (N)`** khi đã tick checkbox + Snapshot `HoSoDaGui`.
- **Tra cứu XML1 ([xml1-viewer/page.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/%28modules%29/xml1-viewer/page.tsx))**: Bỏ nút `Xóa theo bộ lọc`; bổ sung nút **`Chọn tất cả (<tổng>)`** để tick toàn bộ hồ sơ khớp bộ lọc hiện tại (tối đa `15.000` hồ sơ) + nút `Bỏ chọn`, và chỉ cho phép xóa bằng nút **`Xóa (N) hồ sơ`** từ checkbox + Snapshot danh sách `MA_LK` (`restorable: false`).
- **Yêu cầu IT / HCQT / VTYT ([SharedRequestsPage.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/error-management/it-requests/components/SharedRequestsPage.tsx), [TicketHeader.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/error-management/it-requests/components/TicketHeader.tsx), [error-management/config/page.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/error-management/config/page.tsx))**: Bỏ nút `Xóa tất cả dữ liệu` trên header và bỏ nút `Xóa tất cả lý do (Dọn CSDL)` trên cấu hình; giữ xóa lẻ có `Popconfirm`.

### 3.3. Đợt 3 — Khóa API Delete thiếu xác thực & bổ sung `Popconfirm` cấu hình UI
- **Khóa phân quyền Backend (`authorizeApiRequest`)**:
  - Quyền `ADMIN`: `DELETE /api/admin/notifications/config`, `DELETE /api/page-instructions`, `POST`/`DELETE /api/rules/draft/[id]`.
  - Theo phân quyền Menu `MENU_DYNAMIC_FORMS` (hoặc `ADMIN`): `DELETE /api/dynamic-forms/[id]`, `DELETE /api/dynamic-forms/[id]/data/[rowId]`.
  - Theo vai trò quản lý Nhân sự (`ADMIN`, `PTCCB`, `TCCB`, `CNTT`, kèm `KHOA`/`KHOA_PHONG` với đào tạo): `DELETE /api/staff/reports/[id]`, `DELETE /api/staff-training`.
  - Tài khoản đăng nhập hợp lệ (chặn chưa đăng nhập `401` và `GUEST` `403`): `DELETE /api/beds`, `DELETE /api/pdf-reports`, `DELETE /api/saved-reports/[filename]`, `DELETE /api/excel-templates/[id]`, `DELETE /api/equipments/[id]`, `DELETE /api/warehouses/[id]`, `DELETE /api/inventory-vouchers/[id]`, `POST /api/clinical-scheduling/save-schedule`, và `POST /api/clinical-scheduling/delete-schedule` (giữ nguyên nút `Xóa tất cả (Reset)` lịch trực 1 ngày/1 khoa ở `/clinical-scheduling/saved-schedules` + tự động Snapshot `ClinicalScheduleRecord` khi Reset).
  - Giữ nguyên không khóa cổng KSK ngoài (`/api/ksk-toan-dan`) và các trang tra cứu công khai (`/doc-file-excel`, `/pttt-excel`, `/chuyen-de`, `/icd10`).
- **Bổ sung `Popconfirm` Tầng Vàng trên UI**:
  - Xóa quy tắc tại [excel-checker/builder](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/excel-checker/builder/page.tsx).
  - Xóa trường dữ liệu tại [dynamic-forms/edit](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/dynamic-forms/%5Bid%5D/edit/page.tsx).
  - Xóa trường tự tạo tại [DynamicForm.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/components/shared/DynamicForm.tsx).

---

## 4. Tài liệu API Snapshot (`/api/admin/delete-snapshots`)
File route: [delete-snapshots/route.ts](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/api/admin/delete-snapshots/route.ts) (bắt buộc quyền `ADMIN`).

- **`GET /api/admin/delete-snapshots`**: Trả về tối đa 200 Snapshot gần nhất (hỗ trợ `?tableName=...`).
- **`GET /api/admin/delete-snapshots?id={id}&download=true`**: Giải nén và tải file `.json` gốc.
- **`POST /api/admin/delete-snapshots`** (`{ "id": "..." }`): Khôi phục bản ghi từ Snapshot hỗ trợ `restorable: true` bằng `createMany({ skipDuplicates: true })`.
- **`DELETE /api/admin/delete-snapshots?id={id}`**: Xóa 1 Snapshot để giải phóng dung lượng.
- **`DELETE /api/admin/delete-snapshots?deleteAll=true&confirmDeleteAll=true`**: Dọn toàn bộ Snapshot trong DB.

### Bảng hỗ trợ khôi phục tự động (`restorable`)
| Loại bảng Snapshot | Hỗ trợ khôi phục 1-click trên Web (`restorable`) | Ghi chú |
| :--- | :---: | :--- |
| `Staff` (kèm CCHN, Phạm vi, Đào tạo, Công tác), `PracticingCertificate`, `ScopeOfPracticeCatalog`, `ScopeServiceMapping`, `Department`, `TT32Category`, `DoctorServiceMapping`, `DepartmentCatalog`, `Mau02Catalog`..`Mau06Catalog`, `ValidationRule`, `HoSoDaGui` | ✅ Có (`true`) | Khôi phục theo đúng thứ tự khóa ngoại, bỏ qua bản ghi đã tồn tại |
| `Xml1`, `ITRequest`, `ClinicalScheduleRecord` | 📥 Tải JSON (`false`) | Bảng lớn / có quan hệ lồng nhau phức tạp; tải JSON về để đối chiếu hoặc xử lý thủ công |

---

## 5. Hướng dẫn thao tác & Dọn Snapshot sau khi dùng
1. **Xóa dữ liệu an toàn theo Checkbox**:
   - Tick vào các dòng cần xóa (hoặc dùng nút **Chọn tất cả** ở `/xml1-viewer` sau khi lọc).
   - Bấm **`Xóa đã chọn (N)`** → xác nhận trên hộp thoại `Popconfirm`.
2. **Xem, tải về, khôi phục hoặc xóa dọn Snapshot**:
   - Truy cập `/htqlbenhvien/admin/delete-snapshots` hoặc bấm nút **Snapshot** ở trang `/staff`.
   - Có thể bấm **Khôi phục** nếu lỡ tay xóa nhầm các dòng đã tick, tải `.json`, hoặc bấm **Dọn sạch Snapshot** sau khi kiểm tra ổn định để giải phóng dung lượng CSDL.
