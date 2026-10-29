# Hướng Dẫn Sử Dụng & Kỹ Thuật: Tải Lên Ảnh Đại Diện (Avatar)

## 1. Giới Thiệu Tính Năng
Tính năng cho phép người dùng tùy chỉnh ảnh đại diện (Avatar) cho tài khoản cá nhân. Ảnh đại diện sẽ hiển thị ngay trên thanh TopHeader, trong danh mục thông tin tài khoản và toàn bộ hệ thống.

---

## 2. Thông Tin Kỹ Thuật

### 2.1. Cơ sở dữ liệu (Prisma / PostgreSQL)
- **Bảng**: `User`
- **Trường bổ sung**:
  - `avatar` (`String?`): Lưu đường dẫn tương đối tới ảnh đại diện của người dùng (Ví dụ: `/uploads/avatars/avatar_1_1740000000.png`). Trường này là tùy chọn (`optional`), nếu `null` hệ thống tự động hiển thị chữ cái đầu của tên hoặc tên đăng nhập.

### 2.2. API Routes

#### A. Upload ảnh đại diện
- **Endpoint**: `POST /api/upload/avatar`
- **Xác thực**: Yêu cầu đã đăng nhập (`auth_token` cookie).
- **Body**: `multipart/form-data`
  - `file`: Tệp ảnh (`File`).
- **Ràng buộc**:
  - Định dạng cho phép: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.
  - Dung lượng tối đa: `5MB`.
- **Response Thành công (200)**:
  ```json
  {
    "success": true,
    "url": "/uploads/avatars/avatar_1_1772180000000.png",
    "filename": "avatar_1_1772180000000.png",
    "size": 154200
  }
  ```
- **Response Lỗi (400/401/500)**:
  ```json
  {
    "error": "Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn."
  }
  ```

#### B. Lưu đường dẫn Avatar vào Hồ sơ
- **Endpoint**: `PUT /api/auth/profile`
- **Body**: `application/json`
  ```json
  {
    "name": "Nguyễn Văn A",
    "avatar": "/uploads/avatars/avatar_1_1772180000000.png"
  }
  ```
  *(Truyền `avatar: null` nếu muốn gỡ bỏ ảnh đại diện).*

---

## 3. Giao Diện & Component
- **Component tải lên**: `src/components/profile/AvatarUploader.tsx`
  - Hiển thị avatar tròn với khung bóng mờ thẩm mỹ.
  - Hỗ trợ xem trước (preview) tức thì.
  - Nút bấm "Tải ảnh lên" / "Đổi ảnh đại diện" và nút chụp camera nhỏ góc dưới ảnh.
  - Nút "Gỡ ảnh" để quay về chữ cái mặc định kèm hộp thoại xác nhận (Popconfirm).
- **Modal Hồ sơ**: `src/components/profile/EditProfileModal.tsx`
- **Hiển thị thanh trên**: `src/components/architect/TopHeader.tsx`

---

## 4. Hướng Dẫn Thao Tác Cho Người Dùng

1. **Mở hộp thoại Cập nhật Hồ sơ**:
   - Nhấp chuột vào biểu tượng Avatar hoặc Tên người dùng ở góc trên bên phải màn hình.
   - Chọn mục **"Cập nhật Hồ sơ"**.
2. **Tải lên / Đổi ảnh đại diện**:
   - Tại tab **"Thông tin cá nhân"**, khu vực trên cùng hiển thị ảnh đại diện.
   - Nhấp vào nút **"Tải ảnh lên"** (hoặc biểu tượng máy ảnh tròn nhỏ) và chọn một file ảnh từ máy tính (hỗ trợ JPG, PNG, WEBP dưới 5MB).
   - Ảnh mới sẽ được tải lên máy chủ và hiển thị xem trước ngay lập tức.
3. **Lưu thay đổi**:
   - Nhấp nút **"Lưu thay đổi"** ở góc dưới cùng form hồ sơ.
   - Hệ thống sẽ lưu thông tin và tự động cập nhật ngay trên thanh công cụ đầu trang.
4. **Gỡ bỏ ảnh đại diện**:
   - Nhấp vào nút **"Gỡ ảnh"** màu đỏ, xác nhận xóa.
   - Nhấp **"Lưu thay đổi"** để hoàn tất.
