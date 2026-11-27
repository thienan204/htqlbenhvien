# HƯỚNG DẪN KHÔI PHỤC CHỨNG CHỈ HÀNH NGHỀ (CCHN) TỪ DANH MỤC MẪU 02

## 1. Mục đích & Phạm vi nghiệp vụ
Tính năng **Khôi phục từ Mẫu 02** (`RestoreFromMau02Modal` tại màn hình `/practicing-certificates`) giúp tài khoản **ADMIN** khôi phục lại toàn bộ dữ liệu Chứng chỉ hành nghề (`PracticingCertificate` và liên kết `CCHNScopeMapping`) từ bảng danh mục Mẫu 02 (`Mau02Catalog`) trong trường hợp dữ liệu CCHN bị mất hoặc thiếu thông tin.

### Nguyên tắc đối chiếu & bảo toàn dữ liệu
Vì bảng `Mau02Catalog` không lưu trường `ma_nv` mà chỉ lưu `SO_DINH_DANH` (Số CCCD / định danh), hệ thống thực hiện đối chiếu an toàn với bảng `Staff` theo thứ tự ưu tiên:
1. **Ưu tiên 1 (`CCCD`)**: So khớp `SO_DINH_DANH` (đã chuẩn hóa khoảng trắng, hỗ trợ trường hợp Excel mất số `0` đầu của CCCD 12 số) với `decryptField(staff.cccd)` và chỉ mục `staff.cccd_hash` (`generateBlindIndex`).
2. **Ưu tiên 2 (`MA_NV`)**: Nếu chưa khớp CCCD, đối chiếu `SO_DINH_DANH` với `staff.ma_nv`.
3. **Ưu tiên 3 (`HO_TEN_KHOA`)**: Đối chiếu `HO_TEN` chuẩn hóa kết hợp `MA_KHOA` / `TEN_KHOA` (chỉ tự động ghép khi khớp **duy nhất 1 nhân sự**).
4. **Ưu tiên 4 (`HO_TEN_DUY_NHAT`)**: Đối chiếu `HO_TEN` duy nhất toàn viện (nếu trùng tên nhiều người sẽ đưa sang tab **Chưa khớp** để admin tự kiểm tra).

### Quy tắc Merge an toàn (Không ghi đè mất dữ liệu mới)
- **CCHN mới chưa có trong Mẫu 02**: Được giữ nguyên tuyệt đối (không xóa).
- **CCHN đã tồn tại cùng `(staffId, so_cchn)`**: Chỉ điền bổ sung các trường đang trống (`ngay_cap`, `noi_cap_cchn_id`, `CCHNScopeMapping`, `pham_vi_bo_sung`, `dich_vu_ky_thuat`, `vb_phan_cong`, `thoi_gian_*`, `cskcb_*`, `qd_cgkt`, `tu_ngay`, `den_ngay`) khi bật tùy chọn bổ sung.
- **Lưu ý giới hạn Mẫu 02**: Trường **Nhóm phân quyền (TT32)** không tồn tại trong `Mau02Catalog` nên không thể tự khôi phục từ Mẫu 02.

---

## 2. Tài liệu Component Frontend
- **Component**: [`RestoreFromMau02Modal`](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/practicing-certificates/components/RestoreFromMau02Modal.tsx)
- **Màn hình tích hợp**: [`PracticingCertificatesPage`](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/practicing-certificates/page.tsx) (nút **Khôi phục từ Mẫu 02**, chỉ hiển thị khi `user.role === 'ADMIN'`).

### Props chính
| Prop | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `open` | `boolean` | Điều khiển đóng/mở Modal; tự động gọi API chế độ `preview` khi mở |
| `onClose` | `() => void` | Đóng Modal không thay đổi dữ liệu |
| `onSuccess` | `() => void` | Callback sau khi khôi phục `execute` thành công để tải lại danh sách CCHN |

### Luồng thao tác cho người dùng (User Guide)
1. Đăng nhập bằng tài khoản **ADMIN**, truy cập màn hình **Quản lý CCHN** (`/htqlbenhvien/practicing-certificates`).
2. Bấm nút **Khôi phục từ Mẫu 02** ở góc trên bên phải. Hệ thống tự động chạy đối chiếu xem trước (không ghi DB) và hiển thị thống kê qua 4 tab (`Tabs type="card"`): **Tạo mới**, **Bổ sung trường thiếu**, **Chưa khớp**, **Đã đầy đủ**.
3. Kiểm tra kỹ danh sách ở các tab (có thể gõ ô tìm kiếm hoặc bật/tắt tùy chọn bổ sung trường thiếu), sau đó bấm **Xác nhận khôi phục** → xác nhận trên hộp thoại Popconfirm để ghi dữ liệu vào hệ thống.

---

## 3. Tài liệu API Route

### `POST /api/practicing-certificates/restore-from-mau02`
Khôi phục hoặc chạy thử (dry-run preview) dữ liệu `PracticingCertificate` & `CCHNScopeMapping` từ bảng `Mau02Catalog`.

- **Quyền truy cập**: Bắt buộc đăng nhập với `role === 'ADMIN'` (cookie session).
- **Headers**:
  - `Content-Type: application/json`

#### Request Body
```json
{
  "mode": "preview",
  "options": {
    "updateExistingEmptyFields": true
  }
}
```
- `mode`: `"preview"` (mặc định — chỉ phân tích, không ghi DB) hoặc `"execute"` (thực thi ghi DB theo batch transaction).
- `options.updateExistingEmptyFields`: `boolean` (mặc định `true` — bổ sung các trường còn trống cho CCHN đã có).

#### Response thành công (`200 OK`) — `mode: "preview"`
```json
{
  "mode": "preview",
  "summary": {
    "totalMau02Rows": 870,
    "totalMau02WithCchn": 632,
    "skippedNoCchnCount": 238,
    "createCount": 629,
    "updateCount": 1,
    "skipCount": 0,
    "unmatchedCount": 0,
    "preservedExistingCount": 2,
    "existingTotalCertCount": 3,
    "newNoiCapCategories": []
  },
  "candidates": [],
  "unmatched": []
}
```

#### Response thành công (`200 OK`) — `mode: "execute"`
```json
{
  "mode": "execute",
  "success": true,
  "result": {
    "createdCount": 629,
    "updatedCount": 1,
    "skippedCount": 0,
    "unmatchedCount": 0,
    "preservedExistingCount": 2,
    "createdNoiCapCount": 0,
    "scopeMappingsAddedCount": 611
  },
  "unmatched": []
}
```

#### Các mã lỗi thường gặp
| Mã HTTP | Nguyên nhân | Ví dụ Response |
| :--- | :--- | :--- |
| `401` | Chưa đăng nhập | `{ "error": "Vui lòng đăng nhập để thực hiện thao tác này." }` |
| `403` | Không phải tài khoản `ADMIN` | `{ "error": "Chỉ tài khoản ADMIN mới có quyền khôi phục dữ liệu CCHN từ Mẫu 02." }` |
| `500` | Lỗi hệ thống / CSDL | `{ "error": "Lỗi khi khôi phục dữ liệu CCHN từ Mẫu 02: ..." }` |

---

## 4. Cải tiến an toàn dữ liệu liên quan
- **`DELETE /api/staff` ([route.ts](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/api/staff/route.ts))**: Bổ sung kiểm tra đăng nhập & phân quyền (`ADMIN` cho thao tác xóa toàn bộ), yêu cầu tham số xác nhận `confirmDeleteAll=true`, và bọc toàn bộ lệnh xóa trong `prisma.$transaction(...)` để tránh tình trạng xóa sạch `PracticingCertificate` khi xóa `Staff` bị chặn bởi khóa ngoại chấm công/nghỉ phép (`P2003`).
- **`GET /api/practicing-certificates` & `GET /api/staff`**: Bổ sung vai trò `PTCCB`, `TCCB`, `CNTT` vào nhóm xem toàn viện.
- **Chuẩn hóa parse mã phạm vi CM ([BulkUpdateCchnModal.tsx](file:///d:/1.ProjectBVDKLS/htqlbenhvien/src/app/practicing-certificates/components/BulkUpdateCchnModal.tsx))**: Hỗ trợ mã phạm vi có dấu chấm (ví dụ `102.04`) và chuẩn hóa đường dẫn `getBasePath()`.

