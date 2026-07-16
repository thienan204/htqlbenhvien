import { NextRequest, NextResponse } from 'next/server';
import { emitEvent } from '../../../../lib/notificationService';

// Định dạng dữ liệu yêu cầu:
// {
//   "eventCode": "KIOSK_NEW_PATIENT",
//   "ma_khoa": "K01",
//   "context": {
//     "ma_khoa": "K01",
//     "ten_benh_nhan": "Nguyễn Văn A",
//     "id": "12345"
//   }
// }
// HOẶC Gửi thông báo thủ công không cần template:
// {
//   "eventCode": "MANUAL_ALERT",
//   "ma_khoa": "K01",
//   "title": "Thông báo khẩn",
//   "body": "Nội dung khẩn",
//   "url": "..."
// }

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const { eventCode, ma_khoa, context, title, body, url } = payload;

    if (!eventCode) {
      return NextResponse.json({ error: 'Missing eventCode' }, { status: 400 });
    }

    // Nếu không có context nhưng có ma_khoa, tự động thêm ma_khoa vào context để tiện cho template
    const finalContext = context || {};
    if (ma_khoa && !finalContext.ma_khoa) {
      finalContext.ma_khoa = ma_khoa;
    }

    const eventPayload = {
      context: finalContext,
      title,
      body,
      url
    };

    // Gọi hàm emitEvent, nó sẽ tự xử lý template (nếu có) và gửi cho ma_khoa
    await emitEvent(eventCode, eventPayload, ma_khoa);

    return NextResponse.json({ success: true, message: 'Notification sent successfully' });
  } catch (error: any) {
    console.error('[Webhook] Error sending notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
