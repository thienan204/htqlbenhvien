# Hướng dẫn tích hợp Push Notification (FCM) cho App Mobile

Tài liệu này tổng hợp cấu trúc và các bước thiết lập hệ thống Push Notification để gửi cảnh báo về điện thoại khi có yêu cầu IT (hoặc các sự kiện khác) mới.

## 1. Cơ sở dữ liệu (Prisma)
- Cài đặt thư viện `firebase-admin` vào Next.js để server có thể giao tiếp với Firebase.
- Bảng `UserDeviceToken` trong Prisma Schema được dùng để lưu trữ Token thiết bị (FCM Token) của người dùng:
  ```prisma
  model UserDeviceToken {
    id        String   @id @default(cuid())
    userId    String
    token     String   @unique
    platform  String?
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  }
  ```

## 2. API Lưu Token (Dành cho App Mobile)
Khi người dùng đăng nhập thành công vào App Flutter, App cần sinh ra FCM Token và gửi lên server để lưu lại.
- **Endpoint**: `POST /api/mobile/auth/device-token`
- **Headers**: Yêu cầu `Authorization: Bearer <jwt_token>`
- **Body**: 
  ```json
  { 
    "token": "fcm_token_day", 
    "platform": "android" 
  }
  ```

## 3. Tích hợp bắn thông báo khi có yêu cầu mới
Hệ thống bắn thông báo Push Notification tự động thông qua hàm `sendPushNotification(tokens, title, body)` được định nghĩa trong `src/lib/firebase-admin.ts`.

- **Web tạo phiếu (`POST /api/error-management/it-requests/route.ts`)**: Tự động tìm token của phòng ban đích (ví dụ CNTT) hoặc người được phân công (assignee) để bắn thông báo Push về máy.
- **App tạo phiếu (`POST /api/mobile/it-requests/route.ts`)**: Chức năng tương tự khi phiếu được tạo từ phía Mobile.

## 4. Các bước thiết lập quan trọng (Dành cho Dev/Admin)

Để hệ thống hoạt động thực tế, bạn cần thiết lập cấu hình kết nối Firebase:

1. **Khởi động lại Server**: Nếu bạn vừa update Database hoặc cài thư viện mới, hãy khởi động lại tiến trình `npm run dev`.
2. **Cấu hình biến môi trường (`.env`)**:
   Mở file `.env` của project Next.js và thêm cấu hình lấy từ Firebase Console (Project Settings -> Service Accounts -> Generate new private key):
   ```env
   FIREBASE_PROJECT_ID="tên-project-id-cua-ban"
   FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@..."
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
   ```
3. **Phía Mobile (Flutter)**:
   - Cài đặt `firebase_core` và `firebase_messaging`.
   - Lấy FCM Token và gọi API `/api/mobile/auth/device-token` để đồng bộ token với Backend.
