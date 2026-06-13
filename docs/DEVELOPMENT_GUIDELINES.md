# 🚀 QUY TẮC PHÁT TRIỂN & BẢO TRÌ (DEVELOPMENT GUIDELINES)

Tài liệu này đóng vai trò như một bộ "Luật" (Rules) và "Kỹ năng" (Skills) buộc AI phải tuân theo khi tham gia phát triển, bảo trì hệ thống Bệnh viện.

## 1. NGUYÊN TẮC TỐI THƯỢNG: TRÌNH BÀY KẾ HOẠCH TRƯỚC, CODE SAU
> **BẮT BUỘC:** Trước khi thực hiện bất kỳ thay đổi nào về code (thêm/sửa/xóa file, chạy lệnh terminal...), AI **PHẢI** đưa ra phương án chi tiết (Implementation Plan). Phương án phải bao gồm: sửa file nào, logic chạy ra sao, thay đổi Database thế nào. Sau khi đưa ra phương án, AI **PHẢI DỪNG LẠI** và đợi User phản hồi "Đồng ý" hoặc "OK" thì mới được phép tiến hành viết code. KHÔNG BAO GIỜ được tự ý code khi chưa có sự phê duyệt.

## 2. NGUYÊN TẮC ĐÁNH GIÁ TÁC ĐỘNG & BẢO TOÀN CHỨC NĂNG CŨ (IMPACT ANALYSIS)
- **Tuyệt đối cách ly:** Khi xây dựng module/chức năng mới, mã nguồn phải được viết trong thư mục hoặc file tách biệt hoàn toàn (đúng theo Kiến trúc Module). Hạn chế tối đa việc sửa đổi trực tiếp vào code của các module đang hoạt động ổn định.
- **Cảnh báo Bắt buộc:** Nếu tính năng mới BẮT BUỘC PHẢI SỬA một file/code dùng chung (như `schema.prisma`, `layout.tsx`, Components dùng chung, hoặc API cũ...), AI **PHẢI ĐƯA LỜI CẢNH BÁO RÕ RÀNG** trong bản Kế hoạch (Implementation Plan) để User nắm được: *"Sửa file này có thể ảnh hưởng đến chức năng X, Y, Z"*. Chỉ khi User chấp nhận rủi ro này thì mới tiến hành.

## 3. QUY TRÌNH LÀM VIỆC BẮT BUỘC (4 BƯỚC)
Bất kể yêu cầu lớn hay nhỏ, AI luôn phải tuân thủ luồng sau (sau khi kế hoạch đã được duyệt):
1. **Phân tích & Database:** Xem xét kỹ yêu cầu. Nếu cần sửa DB (`schema.prisma`), phải tạo bản nháp (Implementation Plan) đưa người dùng duyệt. KHÔNG tự ý sửa DB khi chưa có sự đồng ý.
2. **Xây dựng API (Backend):** Viết API route (`src/app/api/...`). API phải trả về chuẩn chung:
   - Thành công: `{ success: true, data: ... }`
   - Thất bại: `{ success: false, message: 'Mô tả lỗi', error: ... }`
3. **Xây dựng Giao diện (Frontend):** Viết UI Component tại `src/modules/...` (nếu có kiến trúc module) hoặc `src/components/...`.
4. **Kiểm thử & Báo cáo:** Xác nhận tính năng đã hoạt động, xử lý các trường hợp lỗi (Edge cases) và báo cáo lại bằng tiếng Việt. Mọi bước phải chi tiết. Đợi user "OK" mới qua bước tiếp theo.

## 4. QUY TẮC VIẾT CODE & KIẾN TRÚC (CLEAN CODE)
- **Kiến trúc Module:** Hệ thống đang chuyển dịch sang quản lý theo Module. Code mới (HR, Tài sản...) phải được đặt trong thư mục riêng lẻ (Ví dụ: `src/modules/hr/components`, `src/app/(modules)/hr/...`).
- **Tách biệt Logic:** Không viết hàm gọi API dài dòng trực tiếp bên trong giao diện (UI). Các hàm gọi dữ liệu, tính toán phức tạp phải tách ra file riêng (hooks hoặc services).
- **TypeScript:** Không sử dụng `any` một cách bừa bãi. Phải khai báo interface/type rõ ràng cho các object dữ liệu truyền qua lại giữa Frontend và Backend.
- **Xử lý lỗi (Error Handling):** 
  - Trên Server: Luôn bọc bằng `try/catch`. Không để ứng dụng bị crash (sập).
  - Trên Giao diện: Hiển thị thông báo thân thiện bằng `message.error` hoặc `notification` của Ant Design.

## 5. QUY TẮC BÌNH LUẬN & TÀI LIỆU (DOCUMENTATION)
- **Bình luận trong Code (Inline Comments):** Giải thích rõ ràng bằng tiếng Việt cho những logic tính toán rắc rối, nghiệp vụ y tế, cấu trúc XML.
- **Cập nhật Docs:** Khi hoàn thành một module lớn, phải cập nhật hoặc tạo file tài liệu trong thư mục `docs/` để lưu lại cách sử dụng và luồng nghiệp vụ.

---
> **💡 LƯU Ý DÀNH CHO AI:** Bất cứ khi nào bắt đầu một phiên làm việc mới liên quan đến dự án này, hãy kiểm tra và tuân thủ tuyệt đối các quy tắc trong tài liệu này trước khi viết một dòng code nào.
