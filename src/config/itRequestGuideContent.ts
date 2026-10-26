/**
 * Nội dung bài hướng dẫn sử dụng và thông báo Zalo chuẩn SOP
 * Dành cho chức năng Tạo Yêu Cầu Hỗ Trợ Kỹ Thuật CNTT (/error-management/it-requests/create)
 */

export const IT_REQUEST_GUIDE_HTML = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
    <div style="background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
        <h2 style="color: #1e40af; margin: 0 0 8px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            🏥 HƯỚNG DẪN: GỬI YÊU CẦU HỖ TRỢ KỸ THUẬT CNTT TRỰC TUYẾN
        </h2>
        <p style="margin: 0; font-size: 13px; color: #3b82f6;">
            <strong>Đơn vị phát triển:</strong> Phòng Công nghệ Thông tin - Bệnh viện Đa khoa tỉnh Lạng Sơn &bull; 
            <strong>Trạng thái:</strong> <span style="background: #fef08a; color: #854d0e; padding: 2px 8px; border-radius: 6px; font-weight: bold; font-size: 11px;">CHẠY THỬ NGHIỆM TOÀN VIỆN</span>
        </p>
    </div>

    <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; font-size: 15px;">
        I. Mục Đích & Ý Nghĩa Chuyển Đổi Số
    </h3>
    <p>Chức năng tiếp nhận yêu cầu CNTT trực tuyến giúp chuyển đổi số quy trình hỗ trợ kỹ thuật tại Bệnh viện Đa khoa tỉnh Lạng Sơn:</p>
    <ul style="padding-left: 20px; font-size: 13px;">
        <li><strong>Không lo bận máy hay trôi tin:</strong> Thay thế hoàn toàn việc gọi điện thoại hoặc nhắn tin Zalo cá nhân dễ bị quên, sót việc.</li>
        <li><strong>Tiếp nhận tức thời:</strong> Khi Khoa/Phòng gửi yêu cầu, kỹ thuật viên CNTT sẽ tiếp nhận và xử lý ngay lập tức.</li>
        <li><strong>Minh bạch thông tin người nhận việc:</strong> Hiển thị rõ ràng <strong>Tên kỹ thuật viên</strong> và <strong>Số điện thoại</strong> để Khoa/Phòng tiện liên hệ trực tiếp.</li>
        <li><strong>Tích hợp Chat trực tiếp 2 chiều:</strong> Khoa/Phòng và kỹ thuật viên CNTT có thể nhắn tin, gửi ảnh hiện trường và thảo luận tiến độ ngay trên từng phiếu.</li>
        <li><strong>Lưu vết lịch sử:</strong> Theo dõi tiến độ từ lúc gửi ➔ Đang xử lý ➔ Đã khắc phục xong; nhận chuông thông báo âm thanh tự động khi hoàn thành.</li>
    </ul>

    <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
        <h4 style="margin: 0 0 6px 0; color: #1e3a8a; font-size: 14px;">🔐 Thông Tin Đăng Nhập Mặc Định Cho Nhân Viên</h4>
        <p style="margin: 0; font-size: 13px;">
            &bull; <strong>Tên đăng nhập (Username):</strong> Số Căn cước công dân (CCCD) của bạn (12 chữ số)<br>
            &bull; <strong>Mật khẩu mặc định (Password):</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #b91c1c;">123456</code><br>
            <em>(Khuyến nghị: Sau khi đăng nhập lần đầu, đồng chí nên đổi mật khẩu cá nhân để bảo mật tài khoản).</em>
        </p>
    </div>

    <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; font-size: 15px; margin-top: 20px;">
        II. Hướng Dẫn Các Bước Thao Tác (Chỉ Mất 30 Giây)
    </h3>
    
    <div style="margin-bottom: 14px;">
        <strong style="color: #2563eb; font-size: 14px;">👉 Cách 1: Giao diện Chatbot thông minh ("Tạo Nhanh - Khuyên dùng")</strong>
        <ol style="padding-left: 20px; font-size: 13px; margin-top: 6px;">
            <li>Hệ thống tự động điền Tên người báo và Số điện thoại từ tài khoản đăng nhập.</li>
            <li>Gõ mô tả sự cố vào ô chat (VD: <em>"Máy in khoa Ngoại kẹt giấy"</em>, <em>"Lỗi không ký được bệnh án"</em>...) hoặc nhấp vào các nút lỗi gợi ý sẵn.</li>
            <li>Có thể chụp ảnh màn hình lỗi rồi dán trực tiếp (<code>Ctrl + V</code>) vào ô chat.</li>
            <li>Bấm <strong>"Gửi yêu cầu"</strong> để hoàn tất.</li>
        </ol>
    </div>

    <div style="margin-bottom: 14px;">
        <strong style="color: #0d9488; font-size: 14px;">👉 Cách 2: Gửi sự cố Bệnh án / Phần mềm HIS (Form chi tiết)</strong>
        <ol style="padding-left: 20px; font-size: 13px; margin-top: 6px;">
            <li>Chuyển sang tab <strong>"Bệnh án (Phần mềm)"</strong>.</li>
            <li>Nhập <strong>Mã Bệnh Án (Mã BA)</strong> hoặc <strong>Mã Liên Kết (Mã LK)</strong>.</li>
            <li>Chọn trạng thái bệnh án và danh mục lỗi phần mềm cần hỗ trợ.</li>
            <li>Bấm <strong>"Gửi yêu cầu"</strong>.</li>
        </ol>
    </div>

    <div style="margin-bottom: 14px;">
        <strong style="color: #d97706; font-size: 14px;">👉 Cách 3: Gửi sự cố Thiết bị / Phần cứng (Máy in, Mạng, Máy tính...)</strong>
        <ol style="padding-left: 20px; font-size: 13px; margin-top: 6px;">
            <li>Chuyển sang tab <strong>"Thiết bị (Phần cứng)"</strong>.</li>
            <li>Chọn loại thiết bị (Máy in, Mạng, Màn hình, Cây máy tính...).</li>
            <li>Nhập vị trí đặt máy tại khoa và mô tả sự cố. Bấm <strong>"Gửi yêu cầu"</strong>.</li>
        </ol>
    </div>

    <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; font-size: 15px; margin-top: 20px;">
        III. Tiếp Nhận Thông Tin Kỹ Thuật Viên & Chat Trao Đổi 2 Chiều
    </h3>
    <ul style="padding-left: 20px; font-size: 13px;">
        <li><strong>Xem người nhận việc:</strong> Sau khi gửi, tại danh sách yêu cầu sẽ hiện ngay <strong>Tên kỹ thuật viên CNTT phụ trách</strong> và <strong>Số điện thoại</strong>.</li>
        <li><strong>Chat trực tiếp trên phiếu:</strong> Mở phiếu yêu cầu để nhắn tin, gửi thêm hình ảnh hoặc hỏi tiến độ trực tiếp với kỹ thuật viên mà không cần qua Zalo.</li>
        <li><strong>Chuông báo hoàn thành:</strong> Khi kỹ thuật viên xử lý xong, hệ thống sẽ phát âm thanh chuông thông báo nghiệm thu.</li>
    </ul>

    <div style="background: #fefce8; border: 1px dashed #ca8a04; border-radius: 8px; padding: 14px 16px; margin-top: 20px;">
        <h4 style="margin: 0 0 6px 0; color: #854d0e; font-size: 14px;">💡 Xin Ý Kiến Đóng Góp Từ Các Khoa / Phòng</h4>
        <p style="margin: 0; font-size: 13px; color: #713f12;">
            Hệ thống đang trong giai đoạn <strong>CHẠY THỬ NGHIỆM</strong>. Phòng CNTT rất mong nhận được những góp ý quý báu từ các đồng chí Trưởng/Phó khoa, Điều dưỡng trưởng, Bác sĩ và nhân viên:<br>
            &bull; Nhấp vào nút <strong>"Góp ý"</strong> ở góc trên bên phải màn hình.<br>
            &bull; Mọi ý kiến sẽ giúp Phòng CNTT tiếp tục tối ưu phần mềm phục vụ tốt nhất cho bệnh viện!
        </p>
    </div>

    <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; display: flex; justify-content: space-between; align-items: center;">
        <span><strong>Phòng Công nghệ Thông tin</strong> - BVĐK tỉnh Lạng Sơn</span>
        <span>Hỗ trợ kỹ thuật nội bộ: <strong>Ext 115</strong></span>
    </div>
</div>
`;

export function getItRequestZaloText(targetUrl: string): string {
    return [
        `🏥 BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN`,
        `📢 THÔNG BÁO: CHẠY THỬ NGHIỆM HỆ THỐNG GỬI YÊU CẦU HỖ TRỢ CNTT TRỰC TUYẾN`,
        `--------------------------------------------------`,
        `Kính gửi: Lãnh đạo các Khoa, Phòng cùng toàn thể Cán bộ nhân viên bệnh viện.`,
        ``,
        `Nhằm đẩy mạnh công tác CHUYỂN ĐỔI SỐ và nâng cao chất lượng phục vụ công tác khám chữa bệnh, Phòng Công nghệ Thông tin đã hoàn thiện và CHÍNH THỨC ĐƯA VÀO CHẠY THỬ NGHIỆM chức năng "GỬI YÊU CẦU HỖ TRỢ KỸ THUẬT TRỰC TUYẾN" trên Hệ thống Quản lý Bệnh viện.`,
        ``,
        `🌟 CÁC LỢI ÍCH NỔI BẬT:`,
        `1️⃣ KHÔNG LO TRÔI TIN: Thay thế hoàn toàn việc gọi điện thoại bận máy hay nhắn tin Zalo cá nhân dễ bị quên, sót việc.`,
        `2️⃣ TIẾP NHẬN TỨC THỜI: Khi Khoa/Phòng gửi yêu cầu, kỹ thuật viên CNTT sẽ tiếp nhận xử lý ngay.`,
        `3️⃣ MINH BẠCH THÔNG TIN: Hiển thị ngay TÊN KỸ THUẬT VIÊN và SỐ ĐIỆN THOẠI phụ trách để Khoa/Phòng tiện liên hệ trực tiếp.`,
        `4️⃣ TÍCH HỢP CHAT TRỰC TIẾP 2 CHIỀU:`,
        `   • Có giao diện Chatbot thông minh giúp tạo yêu cầu cực nhanh chỉ trong vài câu chat.`,
        `   • Có khung Chat trao đổi trực tiếp trên từng phiếu: Khoa/Phòng và nhân viên CNTT có thể nhắn tin, gửi ảnh hiện trường và thảo luận tiến độ xử lý ngay trong hệ thống.`,
        `5️⃣ LƯU VẾT LỊCH SỬ: Dễ dàng theo dõi tiến độ (Chờ tiếp nhận ➔ Đang xử lý ➔ Đã hoàn thành); có chuông thông báo tự động khi xử lý xong.`,
        ``,
        `--------------------------------------------------`,
        `🔐 THÔNG TIN ĐĂNG NHẬP MẶC ĐỊNH CHO TẤT CẢ NHÂN VIÊN:`,
        `• Tên đăng nhập (Username): SỐ CĂN CƯỚC CÔNG DÂN (CCCD) của bạn`,
        `• Mật khẩu mặc định (Password): 123456`,
        `*(Khuyến nghị: Sau khi đăng nhập lần đầu, đồng chí nên đổi mật khẩu để bảo mật tài khoản cá nhân).*`,
        ``,
        `--------------------------------------------------`,
        `🔗 ĐƯỜNG DẪN TRUY CẬP TRỰC TIẾP:`,
        `👉 ${targetUrl}`,
        ``,
        `📌 3 BƯỚC GỬI YÊU CẦU ĐƠN GIẢN (CHỈ MẤT 30 GIÂY):`,
        `• Bước 1: Mở link trên ➔ Đăng nhập bằng số CCCD và mật khẩu 123456.`,
        `• Bước 2: Tại tab "Tạo Nhanh", gõ nội dung sự cố hoặc chọn nhanh lỗi (Phần mềm HIS, Bệnh án, Máy in, Mạng...). Có thể chụp/dán ảnh lỗi hoặc chat trực tiếp.`,
        `• Bước 3: Nhấn "Gửi yêu cầu". Hệ thống cấp mã phiếu và hiển thị ngay Nhân viên CNTT tiếp nhận.`,
        ``,
        `--------------------------------------------------`,
        `💡 XIN Ý KIẾN ĐÓNG GÓP TỪ CÁC KHOA / PHÒNG:`,
        `Hiện tại chức năng đang trong giai đoạn CHẠY THỬ NGHIỆM toàn viện. Phòng CNTT rất mong nhận được những phản hồi, đóng góp ý kiến quý báu từ các đồng chí Trưởng/Phó khoa, Điều dưỡng trưởng, Bác sĩ và nhân viên các khoa/phòng:`,
        `👉 Các đồng chí vui lòng gửi ý kiến tại nút "Góp ý" (biểu tượng hộp thư góp ý trên góc phải màn hình) hoặc nhắn tin trực tiếp trong phần Chat của từng phiếu yêu cầu.`,
        ``,
        `Mọi ý kiến đóng góp của Khoa/Phòng sẽ là cơ sở quan trọng để Phòng CNTT tiếp tục cải tiến và nâng cao chất lượng phục vụ ngày một tốt hơn!`,
        ``,
        `Trân trọng cảm ơn!`,
        `--------------------------------------------------`,
        `Phòng Công nghệ Thông tin - Bệnh viện Đa khoa tỉnh Lạng Sơn`
    ].join('\n');
}
