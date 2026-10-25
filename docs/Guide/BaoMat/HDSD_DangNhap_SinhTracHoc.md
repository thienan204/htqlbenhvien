# Hướng Dẫn Sử Dụng & Tài Liệu Kỹ Thuật: Bảo Mật Đăng Nhập & Sinh Trắc Học (Passkey / WebAuthn)

> **Mô-đun**: Quản lý Truy cập & Bảo mật Hệ thống  
> **Phiên bản áp dụng**: v2.2.0  
> **Chuẩn kỹ thuật**: W3C WebAuthn / FIDO2 & JWT RFC 7519  
> **Ngày ban hành**: 25/10/2026  

---

## 1. Giới thiệu tổng quan

Hệ thống Quản lý Bệnh viện Đa khoa Lạng Sơn đã được nâng cấp toàn diện về mặt an ninh thông tin, kết hợp giữa **Gia cố bảo mật cơ bản (Security Hardening)** và **Cơ chế xác thực Sinh trắc học (Biometrics / Passkey)** theo tiêu chuẩn công nghiệp:

- **Chống tấn công dò mật khẩu (Brute-force Protection)**: Tự động khóa tạm thời 15 phút nếu người dùng hoặc kẻ gian nhập sai quá 5 lần liên tiếp.
- **Loại bỏ tài khoản cứng (Hardcoded Credentials)**: Gỡ bỏ hoàn toàn logic kiểm tra cứng `admin/123456`, chuyển sang lưu trữ băm mật khẩu `bcrypt` chuẩn trong CSDL PostgreSQL.
- **Tự động đăng xuất sau 30 phút không hoạt động (Auto Session Idle Timeout)**: Tự động bảo vệ dữ liệu bệnh án điện tử khi cán bộ y tế rời khỏi bàn làm việc tại phòng khám/khoa điều trị.
- **Đăng nhập Sinh trắc học 1-chạm (Passkey / WebAuthn)**: Sử dụng cảm biến vân tay, FaceID trên điện thoại/máy tính bảng hoặc Windows Hello trên PC/Laptop phòng khám để đăng nhập chỉ trong **1 giây**, không cần nhớ hay gõ mật khẩu, hoàn toàn độc lập trong mạng LAN bệnh viện mà không cần Internet hay ứng dụng bên thứ ba.

---

## 2. Hướng dẫn thao tác cho Cán bộ Y tế (User Guide)

### 2.1. Đăng ký thiết bị Sinh trắc học (Lần đầu tiên)
1. Đăng nhập vào hệ thống bằng tài khoản và mật khẩu như thông thường.
2. Nhấp vào tên tài khoản hoặc ảnh đại diện ở góc trên bên phải màn hình (Top Header).
3. Chọn menu **"Sinh trắc học (Passkey)"** (biểu tượng chiếc khiên xanh).
4. Trong cửa sổ hiện ra, nhấn nút **"Đăng ký thiết bị này"**.
5. Nhập tên gợi nhớ cho máy tính hoặc điện thoại (ví dụ: *Laptop Khoa Ngoại*, *iPhone Bác sĩ An*), sau đó bấm **"Bắt đầu Quét Vân tay / FaceID"**.
6. Trình duyệt sẽ hiển thị thông báo của hệ điều hành:
   - **Trên PC/Laptop**: Quét ngón tay lên đầu đọc vân tay hoặc quét khuôn mặt Windows Hello (hoặc nhập PIN máy).
   - **Trên iPhone/iPad/Android**: Chạm ngón tay hoặc nhìn vào camera FaceID.
7. Khi thấy thông báo *"Đăng ký Sinh trắc học thành công"*, thiết bị đã được liên kết vĩnh viễn với tài khoản của bạn.

### 2.2. Đăng nhập bằng Sinh trắc học (Các lần tiếp theo)
1. Truy cập trang đăng nhập hệ thống: `/login`.
2. Chuyển sang thẻ **"Sinh trắc học"** (tab có biểu tượng khiên bảo mật).
3. Nhập Tên tài khoản, Mã nhân viên hoặc CCCD (hoặc có thể để trống nếu thiết bị đã lưu Passkey).
4. Nhấn nút nổi bật **"Chạm Vân tay / Quét FaceID"**.
5. Chạm vân tay hoặc quét FaceID trên thiết bị.
6. Hệ thống xác thực và tự động đưa bạn vào màn hình làm việc trong vòng **1 giây**.

### 2.3. Hủy liên kết thiết bị cũ
- Nếu bạn đổi điện thoại, cài lại máy tính hoặc làm mất thiết bị:
  1. Vào menu cá nhân &rarr; chọn **"Sinh trắc học (Passkey)"**.
  2. Tìm thiết bị cần hủy trong danh sách &rarr; bấm biểu tượng **Thùng rác** &rarr; chọn **"Xóa"**.

---

## 3. Kiến trúc kỹ thuật & CSDL (Database Schema)

### 3.1. Các bảng cơ sở dữ liệu mới (Additive-Only)

#### Bảng `UserPasskey` (Lưu trữ chứng thực WebAuthn)
| Trường | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `id` | `String (cuid)` | Định danh duy nhất bản ghi |
| `userId` | `String` | Khóa ngoại liên kết tới bảng `User` |
| `credentialId` | `String (unique)` | ID chuỗi Base64URL của khóa sinh trắc học |
| `publicKey` | `Bytes` | Khóa công khai (Public Key) dùng để kiểm tra chữ ký số |
| `counter` | `BigInt` | Bộ đếm chữ ký tăng dần nhằm chống tấn công phát lại (Replay attack) |
| `deviceName` | `String?` | Tên gợi nhớ của thiết bị cán bộ đặt |
| `transports` | `String[]` | Phương thức giao tiếp phần cứng (`internal`, `usb`, `hybrid`...) |
| `createdAt` | `DateTime` | Ngày giờ đăng ký |
| `lastUsedAt` | `DateTime?` | Ngày giờ đăng nhập gần nhất bằng thiết bị này |

#### Bảng `WebAuthnChallenge` (Lưu thử thách xác thực)
| Trường | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `id` | `String (cuid)` | Định danh challenge |
| `challenge` | `String (unique)` | Chuỗi ngẫu nhiên bảo mật phát ra từ server |
| `userId` | `String?` | ID người dùng tương ứng (nếu có) |
| `type` | `String` | `'registration'` hoặc `'authentication'` |
| `expiresAt` | `DateTime` | Thời điểm hết hạn (mặc định sau 5 phút) |

#### Bảng `LoginAttempt` (Bảo vệ chống Brute-force)
| Trường | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `id` | `String (cuid)` | Mã lần đăng nhập |
| `username` | `String` | Tên tài khoản hoặc định danh đã thử |
| `ipAddress` | `String?` | Địa chỉ IP gửi yêu cầu |
| `success` | `Boolean` | Kết quả thử (`false` = sai mật khẩu) |
| `createdAt` | `DateTime` | Thời điểm thực hiện |

---

## 4. Tài liệu chi tiết các API Routes

### 4.1. `POST /api/auth/passkey/register-challenge`
- **Mục đích**: Phát sinh Challenge ngẫu nhiên để chuẩn bị đăng ký vân tay/FaceID cho cán bộ y tế đang đăng nhập.
- **Yêu cầu đăng nhập**: Bắt buộc (Cookie `auth_token`).
- **Response thành công (`200 OK`)**:
  ```json
  {
    "challenge": "TdgMUPBEzAb_iyjAF3YwRiMpy9PTSMv-up4s_8j3pKI",
    "rp": { "name": "BVĐK Lạng Sơn - Quản lý Bệnh viện", "id": "localhost" },
    "user": { "id": "...", "name": "admin", "displayName": "Quản trị viên" },
    "pubKeyCredParams": [{ "alg": -7, "type": "public-key" }],
    "timeout": 60000,
    "attestation": "none"
  }
  ```

### 4.2. `POST /api/auth/passkey/register-verify`
- **Mục đích**: Xác thực chữ ký đăng ký từ trình duyệt và lưu Passkey vào cơ sở dữ liệu.
- **Request Body**:
  ```json
  {
    "response": { /* RegistrationResponseJSON từ WebAuthn API */ },
    "deviceName": "Laptop Khoa YHCT"
  }
  ```
- **Response thành công (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Đăng ký đăng nhập bằng Sinh trắc học (Passkey) thành công!"
  }
  ```

### 4.3. `POST /api/auth/passkey/login-challenge`
- **Mục đích**: Lấy Challenge để chuẩn bị quét vân tay/FaceID khi đăng nhập.
- **Request Body (Tùy chọn)**:
  ```json
  {
    "identifier": "admin"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "challenge": "CAnsVsHjjhRoSD1Vy_vSz9QIf9eDXg3jckQJIjiMU4Y",
    "timeout": 60000,
    "rpId": "localhost",
    "allowCredentials": [...]
  }
  ```

### 4.4. `POST /api/auth/passkey/login-verify`
- **Mục đích**: Kiểm tra tính hợp lệ của chữ ký điện tử gửi lên từ phần cứng thiết bị và cấp `auth_token` cookie.
- **Request Body**:
  ```json
  {
    "response": { /* AuthenticationResponseJSON từ WebAuthn API */ }
  }
  ```
- **Response thành công (`200 OK`)**:
  - Gắn Cookie `auth_token` (HttpOnly, Secure trong Production, MaxAge 24h).
  - Trả về JSON:
    ```json
    {
      "success": true,
      "user": { "id": "...", "username": "admin", "name": "Quản trị viên", "role": "ADMIN" }
    }
    ```

### 4.5. `GET /api/auth/passkey/list`
- **Mục đích**: Lấy danh sách các thiết bị đã liên kết của người dùng hiện tại.

### 4.6. `POST /api/auth/passkey/delete`
- **Mục đích**: Hủy liên kết một thiết bị cụ thể.
- **Request Body**: `{ "id": "passkey_cuid" }`

---

## 5. Quy tắc An ninh & Giới hạn thử sai (Brute-Force Protection)
1. **Ngưỡng chặn**: Tối đa **5 lần** đăng nhập sai liên tiếp trong khoảng thời gian **15 phút**.
2. **Hành động khi vượt ngưỡng**:
   - Khóa tạm thời các yêu cầu đăng nhập đối với tài khoản đó trong 15 phút.
   - Trả về thông báo: *"Tài khoản tạm thời bị khóa do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau X phút hoặc liên hệ quản trị viên."*
3. **Mở khóa**:
   - Tự động mở lại sau khi hết thời gian 15 phút.
   - Khi đăng nhập thành công (bằng mật khẩu hoặc Sinh trắc học), toàn bộ lịch sử thử sai trước đó của tài khoản được xóa sạch lập tức.
