# Hướng Dẫn Nghiệp Vụ: Quản Lý Lịch Sử Công Tác & Luân Chuyển Khoa Phòng

## 1. Giới thiệu tổng quan
Tính năng **Quản lý Lịch sử Công tác & Luân chuyển Khoa phòng** giúp Phòng Tổ chức Cán bộ và Ban Giám đốc theo dõi toàn bộ quá trình công tác, luân chuyển giữa các khoa/phòng của từng nhân viên y tế (Bác sĩ, Điều dưỡng, Kỹ thuật viên, Nhân viên hành chính).

Tính năng giải quyết triệt để:
- Lưu vết lịch sử luân chuyển công tác (Từ ngày, Đến ngày, Số quyết định điều động, Lý do điều chuyển).
- Tự động đồng bộ trạng thái khoa phòng làm việc hiện tại sang hồ sơ nhân viên (`Staff`) và tài khoản đăng nhập (`User`).
- Cập nhật thời gian thực tên khoa phòng hiển thị trên thanh Header và màn hình Tạo yêu cầu hỗ trợ CNTT mà không cần nhân viên phải đăng xuất hoặc đợi hết hạn phiên làm việc.

---

## 2. Mô hình Dữ liệu (Prisma Database)

### Model: `StaffWorkHistory`
| Trường dữ liệu | Kiểu | Bắt buộc | Ý nghĩa nghiệp vụ |
| :--- | :--- | :---: | :--- |
| `id` | String (CUID) | Có | Mã định danh bản ghi lịch sử |
| `staffId` | String | Có | Khóa ngoại liên kết tới nhân viên (`Staff`) |
| `ma_khoa` | String | Có | Mã khoa/phòng công tác |
| `chuc_vu_id` | String | Không | Chức vụ tại thời điểm công tác ở khoa |
| `tu_ngay` | DateTime | Có | Ngày bắt đầu làm việc tại khoa |
| `den_ngay` | DateTime | Không | Ngày kết thúc công tác (Nếu đang làm việc thì để trống/`null`) |
| `so_quyet_dinh` | String | Không | Số quyết định điều động/bổ nhiệm (Ví dụ: `289/QĐ-BV`) |
| `ngay_quyet_dinh` | DateTime | Không | Ngày ký quyết định điều động |
| `ghi_chu` | String | Không | Lý do điều chuyển hoặc ghi chú bàn giao |
| `isCurrent` | Boolean | Có | Đánh dấu đây là **Khoa làm việc hiện tại** (`true` / `false`) |

---

## 3. Tài liệu API Routes

### 3.1. Lấy danh sách lịch sử công tác
- **Endpoint**: `GET /api/staff/work-history?staffId={staffId}`
- **Quyền hạn**: Người dùng đã đăng nhập.
- **Query Params**:
  - `staffId`: ID của nhân sự cần tra cứu.
- **Response thành công (`200 OK`)**:
  ```json
  [
    {
      "id": "cm...",
      "staffId": "cmqwavuak007r4z6hzrrsmatv",
      "ma_khoa": "K01",
      "isCurrent": true,
      "tu_ngay": "2026-10-01T00:00:00.000Z",
      "den_ngay": null,
      "so_quyet_dinh": "289/QĐ-BV",
      "ghi_chu": "Điều chuyển sang Khoa Khám bệnh",
      "department": {
        "ma_khoa": "K01",
        "ten_khoa": "Khoa Khám bệnh"
      }
    }
  ]
  ```

### 3.2. Điều chuyển khoa phòng / Thêm mốc lịch sử
- **Endpoint**: `POST /api/staff/work-history`
- **Request Body (Điều chuyển khoa mới)**:
  ```json
  {
    "staffId": "cmqwavuak007r4z6hzrrsmatv",
    "ma_khoa": "K01",
    "tu_ngay": "2026-10-01",
    "so_quyet_dinh": "289/QĐ-BV",
    "ngay_quyet_dinh": "2026-09-28",
    "ghi_chu": "Điều chuyển sang Khoa Khám bệnh",
    "isCurrent": true
  }
  ```
- **Luồng xử lý tự động khi `isCurrent = true`**:
  1. Tự động chốt ngày kết thúc (`den_ngay`) của mốc khoa cũ.
  2. Tạo bản ghi mới với `isCurrent: true`.
  3. Cập nhật `Staff.ma_khoa = khoa mới`.
  4. Đồng bộ `User.ma_khoa = khoa mới`.

---

## 4. Hướng dẫn Thao tác Người dùng (User Guide)

### Thao tác 1: Xem lịch sử công tác của Nhân viên
1. Truy cập menu **Quản lý Nhân sự** (`/staff`).
2. Tìm kiếm nhân viên bằng Tên hoặc Mã nhân viên.
3. Tại cột **Thao tác**, bấm nút màu xanh lá **`🏢 Lịch sử khoa`**.
4. Cửa sổ hiển thị:
   - Banner màu xanh lá trên cùng: Khoa phòng hiện tại nhân viên đang công tác.
   - Bảng danh sách các khoa phòng nhân viên đã từng làm việc trước đây cùng quyết định điều động.

### Thao tác 2: Thực hiện Điều chuyển Nhân sự sang Khoa phòng mới
1. Trong cửa sổ **Lịch sử Công tác & Điều chuyển Khoa phòng**, bấm nút **`+ Điều chuyển khoa mới`**.
2. Nhập các thông tin:
   - **Khoa/Phòng tiếp nhận mới**: Chọn khoa tiếp nhận nhân sự.
   - **Ngày bắt đầu**: Chọn ngày có hiệu lực điều chuyển.
   - **Số quyết định & Ngày ký**: Nhập số QĐ của Giám đốc bệnh viện (nếu có).
   - **Lý do / Ghi chú**: Nhập lý do điều chuyển.
3. Bấm **`Xác nhận điều chuyển`**.
4. **Kết quả**:
   - Nhân viên lập tức được chuyển sang khoa mới.
   - Tài khoản đăng nhập của nhân viên nhận diện ngay khoa mới trên Header và form Tạo yêu cầu CNTT.
