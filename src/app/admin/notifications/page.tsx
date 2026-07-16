'use client';

import React, { useState, useEffect } from 'react';
import { Switch, Table, message, Card, Button, Modal, Form, Input, Space, Tabs, Popconfirm } from 'antd';
import { EditOutlined } from '@ant-design/icons';

interface NotificationSetting {
  id: string;
  eventCode: string;
  eventName: string;
  isEnabled: boolean;
  titleTemplate?: string;
  messageTemplate?: string;
  linkUrl?: string;
  updatedAt: string;
}

export default function NotificationConfigPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<NotificationSetting | null>(null);
  const [form] = Form.useForm();
  const [manualForm] = Form.useForm();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications/config');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        message.error('Lỗi khi tải cấu hình');
      }
    } catch (error) {
      console.error(error);
      message.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const [isAddMode, setIsAddMode] = useState(false);

  const handleToggle = async (eventCode: string, checked: boolean) => {
    try {
      const res = await fetch('/api/admin/notifications/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventCode, isEnabled: checked }),
      });

      if (res.ok) {
        message.success('Cập nhật trạng thái thành công');
        fetchSettings(); // Refresh
      } else {
        message.error('Lỗi khi cập nhật trạng thái');
      }
    } catch (error) {
      console.error(error);
      message.error('Lỗi kết nối máy chủ');
    }
  };

  const handleEdit = (record: NotificationSetting) => {
    setIsAddMode(false);
    setEditingSetting(record);
    form.setFieldsValue({
      eventCode: record.eventCode,
      eventName: record.eventName,
      titleTemplate: record.titleTemplate,
      messageTemplate: record.messageTemplate,
      linkUrl: record.linkUrl,
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setIsAddMode(true);
    setEditingSetting(null);
    form.resetFields();
    // Khởi tạo các giá trị mặc định để bật luôn khi thêm mới
    form.setFieldsValue({
      isEnabled: true
    });
    setIsModalOpen(true);
  };

  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      
      const payload: any = {
        titleTemplate: values.titleTemplate,
        messageTemplate: values.messageTemplate,
        linkUrl: values.linkUrl,
      };

      if (isAddMode) {
        payload.eventCode = values.eventCode;
        payload.eventName = values.eventName;
        payload.isEnabled = true; // Mặc định bật khi thêm mới
      } else if (editingSetting) {
        payload.eventCode = editingSetting.eventCode;
        payload.isEnabled = editingSetting.isEnabled; // Giữ nguyên
      } else {
        return;
      }

      const res = await fetch('/api/admin/notifications/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        message.success(isAddMode ? 'Thêm mới thành công' : 'Lưu cấu hình thành công');
        setIsModalOpen(false);
        fetchSettings(); // Refresh
      } else {
        message.error('Lỗi khi lưu cấu hình');
      }
    } catch (error) {
      console.error(error);
      // form validation error, do nothing
    }
  };

  const handleDelete = async () => {
    if (!editingSetting) return;
    try {
      const res = await fetch(`/api/admin/notifications/config?eventCode=${editingSetting.eventCode}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        message.success('Xóa sự kiện thành công');
        setIsModalOpen(false);
        fetchSettings(); // Refresh
      } else {
        message.error('Lỗi khi xóa sự kiện');
      }
    } catch (error) {
      console.error(error);
      message.error('Lỗi kết nối máy chủ');
    }
  };

  const columns = [
    {
      title: 'Tên Sự kiện',
      dataIndex: 'eventName',
      key: 'eventName',
    },
    {
      title: 'Mã Hệ Thống',
      dataIndex: 'eventCode',
      key: 'eventCode',
    },
    {
      title: 'Cập nhật lần cuối',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (val: string) => new Date(val).toLocaleString('vi-VN'),
    },
    {
      title: 'Kích hoạt',
      key: 'isEnabled',
      render: (_: any, record: NotificationSetting) => (
        <Switch
          checked={record.isEnabled}
          onChange={(checked) => handleToggle(record.eventCode, checked)}
        />
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_: any, record: NotificationSetting) => (
        <Button 
          type="text" 
          icon={<EditOutlined />} 
          onClick={() => handleEdit(record)}
        >
          Cấu hình
        </Button>
      ),
    },
  ];

  const items = [
    {
      key: '1',
      label: 'Cấu hình chung',
      children: (
        <Card 
          title="Cấu hình Thông báo tự động (Gửi về máy khoa phòng)"
          extra={
            <Button type="primary" onClick={handleAddNew}>
              Thêm sự kiện mới
            </Button>
          }
        >
          <p className="mb-4 text-gray-500">
            Khi các sự kiện dưới đây được bật, hệ thống sẽ tự động phát thông báo tới tất cả các máy trạm khoa phòng đang chạy phần mềm Desktop Client.
          </p>
          <Table
            columns={columns}
            dataSource={settings}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </Card>
      ),
    },
    {
      key: '2',
      label: 'Hướng dẫn tích hợp cho IT',
      children: (
        <Card title="Hướng dẫn tích hợp sự kiện mới vào hệ thống">
          <div className="prose max-w-none text-gray-700">
            <h3 className="text-lg font-semibold mb-2">Quy trình tích hợp sự kiện thông báo mới:</h3>
            <p className="mb-4">
              Việc bạn tạo sự kiện ở Tab <strong>Cấu hình chung</strong> giúp định nghĩa sẵn nội dung, tiêu đề và đường dẫn hiển thị. Tuy nhiên, để thông báo thực sự được "bắn" về máy trạm, lập trình viên cần làm theo các bước sau trong mã nguồn hệ thống:
            </p>

            <h4 className="font-semibold text-blue-600 mt-4 mb-2">Bước 1: Import service thông báo</h4>
            <pre className="bg-gray-100 p-3 rounded-md text-sm mb-4">
              {`import { emitEvent } from '@/lib/notificationService';`}
            </pre>

            <h4 className="font-semibold text-blue-600 mt-4 mb-2">Bước 2: Gọi hàm emitEvent tại nơi xảy ra sự kiện</h4>
            <div className="mb-4 text-sm bg-blue-50 p-3 rounded-md border border-blue-200">
              <p className="font-semibold mb-1">Quy tắc tìm file để đặt code (Dự án htqlbenhvien):</p>
              <ul className="list-disc ml-5 mb-2">
                <li>Đoạn code phải được đặt ở <strong>đúng file API xử lý nghiệp vụ</strong> tương ứng (nằm trong thư mục <code>src/app/api/...</code>).</li>
                <li>Tìm đến hàm <code>POST</code> (Tạo mới) hoặc <code>PUT</code> (Cập nhật).</li>
                <li>Chèn đoạn code <code>emitEvent</code> vào ngay sau dòng code thực hiện lưu Database thành công (thường là sau lệnh <code>await prisma...</code>).</li>
              </ul>
              <p className="font-semibold mb-1">Một số vị trí ví dụ:</p>
              <ul className="list-disc ml-5">
                <li><strong>Yêu cầu IT mới:</strong> <code>src/app/api/error-management/it-requests/route.ts</code></li>
                <li><strong>Hồ sơ đã gửi mới:</strong> <code>src/app/api/ho-so-da-gui/route.ts</code></li>
                <li><strong>Cập nhật giường bệnh:</strong> <code>src/app/api/beds/route.ts</code></li>
              </ul>
            </div>
            <p className="mb-2">Tại file đã xác định ở trên, chèn đoạn code sau:</p>
            <pre className="bg-gray-100 p-3 rounded-md text-sm mb-4">
{`await emitEvent(
  'MA_HE_THONG_BAN_DA_TAO', // Ví dụ: 'KIOSK_NEW_PATIENT'
  {
    // Cung cấp dữ liệu context để thay thế vào các biến {{}} bạn đã cấu hình
    context: {
      ma_khoa: 'K01', // Bắt buộc phải có để phân luồng đúng khoa
      ten_benh_nhan: 'Nguyễn Văn A',
      id: 'ID_12345'
    }
  },
  'K01' // (Tuỳ chọn) Tham số thứ 3: Chỉ định mã khoa cụ thể sẽ nhận thông báo.
);`}
            </pre>

            <h4 className="font-semibold text-red-600 mt-4 mb-2">Lưu ý quan trọng:</h4>
            <ul className="list-disc ml-5 space-y-2">
              <li><strong>Mã Hệ Thống</strong> truyền vào hàm <code>emitEvent</code> phải khớp 100% với Mã Hệ Thống đã tạo trên giao diện quản lý.</li>
              <li>Các thuộc tính truyền vào object <code>context</code> phải tương ứng với các biến bạn đã dùng trong Mẫu (Template) ví dụ như <code>{`{{ma_khoa}}`}</code> hay <code>{`{{ten_benh_nhan}}`}</code>.</li>
              <li>Nếu hệ thống sử dụng nhiều máy chủ hoặc worker khác nhau, hãy đảm bảo SSE kết nối đúng tới địa chỉ IP cấu hình.</li>
            </ul>

            <h3 className="text-lg font-semibold mt-8 mb-2">Cách 2: Sử dụng API Webhook mở (Dành cho phần mềm ngoài)</h3>
            <p className="mb-2">Nếu bạn là đối tác viết phần mềm khác (VD: Kiosk, Khám Bệnh) và không muốn can thiệp vào code của <code>htqlbenhvien</code>, bạn chỉ cần gọi API sau:</p>
            <ul className="list-disc ml-5 mb-4 space-y-1">
              <li><strong>URL:</strong> <code>POST /api/notifications/webhook</code></li>
              <li><strong>Header:</strong> <code>Content-Type: application/json</code></li>
            </ul>
            <p className="mb-2"><strong>Mẫu Body (JSON) gửi đi:</strong></p>
            <pre className="bg-gray-100 p-3 rounded-md text-sm mb-4">
{`{
  "eventCode": "KIOSK_NEW_PATIENT", 
  "ma_khoa": "K01",
  "context": {
    "ten_benh_nhan": "Nguyễn Văn A"
  }
}`}
            </pre>
            <p className="text-sm text-gray-600 mb-4">
              <em>Lưu ý: Bạn cũng có thể dùng Webhook này để gửi 1 thông báo tuỳ ý mà không cần quan tâm cấu hình bằng cách gửi <code>{`{"eventCode": "MANUAL_ALERT", "ma_khoa": "K01", "title": "Cảnh báo", "body": "Nội dung"}`}</code></em>
            </p>
          </div>
        </Card>
      ),
    },
    {
      key: '3',
      label: 'Gửi thông báo thủ công',
      children: (
        <Card title="Gửi thông báo nhanh xuống khoa phòng">
          <p className="mb-6 text-gray-500">
            Sử dụng form dưới đây để gửi thông báo khẩn cấp hoặc tin nhắn trực tiếp xuống các máy tính khoa phòng đang chạy Desktop Client.
          </p>
          <div className="max-w-2xl">
            <Form form={manualForm} layout="vertical" onFinish={async (values) => {
              try {
                const res = await fetch('/api/notifications/webhook', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    eventCode: 'MANUAL_ALERT',
                    ma_khoa: values.ma_khoa === 'ALL' ? null : values.ma_khoa,
                    title: values.title,
                    body: values.body,
                    url: values.url
                  })
                });
                
                if (res.ok) {
                  message.success('Đã gửi thông báo thành công!');
                  manualForm.resetFields();
                } else {
                  message.error('Gửi thông báo thất bại.');
                }
              } catch (err) {
                message.error('Lỗi kết nối máy chủ');
              }
            }}>
              <Form.Item 
                label="Mã khoa nhận" 
                name="ma_khoa"
                rules={[{ required: true, message: 'Vui lòng nhập mã khoa!' }]}
                extra="Nhập 'ALL' nếu muốn gửi cho tất cả các khoa. Nhập mã cụ thể (VD: K01) để gửi riêng."
              >
                <Input placeholder="VD: K01 hoặc ALL" />
              </Form.Item>
              
              <Form.Item 
                label="Tiêu đề" 
                name="title"
                rules={[{ required: true, message: 'Vui lòng nhập tiêu đề!' }]}
              >
                <Input placeholder="VD: Thông báo khẩn cấp" />
              </Form.Item>
              
              <Form.Item 
                label="Nội dung thông báo" 
                name="body"
                rules={[{ required: true, message: 'Vui lòng nhập nội dung!' }]}
              >
                <Input.TextArea rows={4} placeholder="VD: Yêu cầu tất cả nhân viên xuống hội trường họp..." />
              </Form.Item>
              
              <Form.Item 
                label="Đường dẫn đính kèm (Tuỳ chọn)" 
                name="url"
                extra="Người nhận bấm vào thông báo sẽ mở trang web này."
              >
                <Input placeholder="VD: https://..." />
              </Form.Item>
              
              <Form.Item>
                <Button type="primary" htmlType="submit" size="large">
                  Gửi ngay lập tức
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Card>
      ),
    }
  ];

  return (
    <div className="p-6">
      <Tabs defaultActiveKey="1" items={items} />

      <Modal
        title={isAddMode ? 'Thêm sự kiện thông báo mới' : `Cấu hình thông báo: ${editingSetting?.eventName}`}
        open={isModalOpen}
        onOk={handleSaveConfig}
        onCancel={() => setIsModalOpen(false)}
        width={700}
        footer={
          <div className="flex justify-between items-center w-full">
            <div>
              {!isAddMode && editingSetting && (
                <Popconfirm
                  title="Bạn có chắc chắn muốn xóa sự kiện này không?"
                  onConfirm={handleDelete}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger>Xóa sự kiện</Button>
                </Popconfirm>
              )}
            </div>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
              <Button type="primary" onClick={handleSaveConfig}>Lưu</Button>
            </Space>
          </div>
        }
      >
        <div className="mb-4 text-sm text-gray-500 bg-blue-50 p-3 rounded-md">
          <p><strong>Gợi ý biến động (Templates):</strong></p>
          <p>Bạn có thể sử dụng các biến sau để chèn dữ liệu động vào thông báo:</p>
          <ul className="list-disc ml-5 mt-1">
            <li><code>{`{{ma_khoa}}`}</code>: Mã khoa</li>
            <li><code>{`{{ten_loi}}`}</code>: Tên lỗi / nội dung yêu cầu</li>
            <li><code>{`{{id}}`}</code>: ID của phiếu yêu cầu (thường dùng cho URL)</li>
          </ul>
        </div>
        <Form form={form} layout="vertical">
          {isAddMode && (
            <div className="grid grid-cols-2 gap-4">
              <Form.Item 
                label="Mã Hệ Thống (Event Code)" 
                name="eventCode" 
                rules={[{ required: true, message: 'Vui lòng nhập mã hệ thống!' }]}
                extra="Ví dụ: NEW_ORDER_RECEIVED (viết hoa, không dấu, cách nhau bởi gạch dưới)"
              >
                <Input placeholder="Ví dụ: SYSTEM_ALERT" />
              </Form.Item>
              <Form.Item 
                label="Tên Sự kiện" 
                name="eventName" 
                rules={[{ required: true, message: 'Vui lòng nhập tên sự kiện!' }]}
              >
                <Input placeholder="Ví dụ: Cảnh báo hệ thống" />
              </Form.Item>
            </div>
          )}
          <Form.Item label="Tiêu đề thông báo" name="titleTemplate">
            <Input placeholder="Ví dụ: Yêu cầu hỗ trợ mới" />
          </Form.Item>
          <Form.Item label="Nội dung thông báo (Body)" name="messageTemplate">
            <Input.TextArea rows={3} placeholder="Ví dụ: Khoa: {{ma_khoa}} - Lỗi: {{ten_loi}}" />
          </Form.Item>
          <Form.Item 
            label="Đường dẫn (URL/Route)" 
            name="linkUrl"
            extra="Đường dẫn sẽ được mở khi click vào thông báo."
          >
            <Input placeholder="Ví dụ: /error-management/it-requests?highlight={{id}}" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
