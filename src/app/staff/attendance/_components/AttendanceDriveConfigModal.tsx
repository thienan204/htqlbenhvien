'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Form, Input, Button, Switch, Alert, message, Tag, Space, Card, Divider, Collapse } from 'antd';
import {
    CloudSyncOutlined,
    CopyOutlined,
    CheckCircleOutlined,
    LinkOutlined,
    FolderOpenOutlined,
    ThunderboltOutlined,
    SafetyCertificateOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
const getBasePath = () => {
    if (typeof window !== 'undefined') {
        const parts = window.location.pathname.split('/staff');
        return parts.length > 1 ? parts[0] : '';
    }
    return '';
};

interface AttendanceDriveConfigModalProps {
    open: boolean;
    onClose: () => void;
    ma_khoa: string;
    deptName?: string;
}

const APPS_SCRIPT_TEMPLATE = `// ============================================================================
// GOOGLE APPS SCRIPT - TỰ ĐỘNG LƯU FILE EXCEL CHẤM CÔNG BVĐK TỈNH LẠNG SƠN
// ============================================================================
// HƯỚNG DẪN TRIỂN KHAI (CHỈ 1 PHÚT):
// 1. Vào https://script.google.com và bấm "Dự án mới" (New project).
// 2. Xóa hết code cũ và dán toàn bộ đoạn mã này vào.
// 3. Bấm "Triển khai" (Deploy) > "Triển khai mới" (New deployment).
// 4. Chọn loại: "Ứng dụng web" (Web App).
// 5. Cấu hình quyền:
//    - Thực thi dưới dạng (Execute as): Tôi (Me - [email của bạn])
//    - Người có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
// 6. Bấm "Triển khai" và Copy đường dẫn "URL ứng dụng web" dán vào phần mềm.
// ============================================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderPath = data.folderPath || 'ChamCong_BVDKLS';
    var files = data.files || [];
    
    // Tìm hoặc tự động tạo cây thư mục lồng nhau
    var pathParts = folderPath.split('/');
    var currentFolder = DriveApp.getRootFolder();
    for (var i = 0; i < pathParts.length; i++) {
      var partName = pathParts[i].trim();
      if (!partName) continue;
      var subFolders = currentFolder.getFoldersByName(partName);
      if (subFolders.hasNext()) {
        currentFolder = subFolders.next();
      } else {
        currentFolder = currentFolder.createFolder(partName);
      }
    }
    
    var uploadedList = [];
    for (var j = 0; j < files.length; j++) {
      var f = files[j];
      var decoded = Utilities.base64Decode(f.base64);
      var blob = Utilities.newBlob(decoded, f.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', f.fileName);
      
      // Xóa file trùng tên cũ nếu đồng bộ lại trong cùng tháng
      var existing = currentFolder.getFilesByName(f.fileName);
      while (existing.hasNext()) {
        existing.next().setTrashed(true);
      }
      
      var newFile = currentFolder.createFile(blob);
      uploadedList.push({
        id: newFile.getId(),
        name: newFile.getName(),
        url: newFile.getUrl()
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      folderUrl: currentFolder.getUrl(),
      folderId: currentFolder.getId(),
      uploadedCount: uploadedList.length,
      files: uploadedList
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

export function AttendanceDriveConfigModal({
    open,
    onClose,
    ma_khoa,
    deptName = 'Khoa / Phòng'
}: AttendanceDriveConfigModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [activeMethod, setActiveMethod] = useState<'APPS_SCRIPT' | 'OAUTH' | 'SERVICE_ACCOUNT'>('APPS_SCRIPT');
    const [lastSyncInfo, setLastSyncInfo] = useState<any>(null);

    // Tải cấu hình hiện tại
    useEffect(() => {
        if (!open) return;
        const fetchConfig = async () => {
            try {
                setLoading(true);
                const basePath = getBasePath();
                const res = await fetch(`${basePath}/api/staff/attendance/drive-sync/config?ma_khoa=${ma_khoa}`);
                const data = await res.json();
                if (data.config) {
                    setActiveMethod(data.config.method || 'APPS_SCRIPT');
                    form.setFieldsValue({
                        method: data.config.method || 'APPS_SCRIPT',
                        isEnabled: data.config.isEnabled !== false,
                        webhookUrl: data.config.webhookUrl || '',
                        oauthEmail: data.config.oauthEmail || '',
                        folderId: data.config.folderId || '',
                        centralFolderId: data.config.centralFolderId || '',
                        notifyEmail: data.config.notifyEmail || '',
                        autoSyncOnLock: data.config.autoSyncOnLock !== false
                    });
                    setLastSyncInfo({
                        lastSyncAt: data.config.lastSyncAt,
                        lastSyncStatus: data.config.lastSyncStatus,
                        lastSyncMessage: data.config.lastSyncMessage,
                        lastSyncFolderUrl: data.config.lastSyncFolderUrl
                    });
                } else {
                    form.setFieldsValue({
                        method: 'APPS_SCRIPT',
                        isEnabled: true,
                        autoSyncOnLock: true
                    });
                }
            } catch (err) {
                console.error('Lỗi tải cấu hình Google Drive:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, [open, ma_khoa, form]);

    // Copy mã mẫu Apps Script
    const handleCopyScript = () => {
        navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
        message.success('Đã sao chép mã Google Apps Script mẫu vào Clipboard!');
    };

    // Kiểm tra thử kết nối
    const handleTestConnection = async () => {
        try {
            const values = await form.validateFields();
            setTesting(true);
            const basePath = getBasePath();
            const res = await fetch(`${basePath}/api/staff/attendance/drive-sync/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: activeMethod,
                    webhookUrl: values.webhookUrl,
                    folderId: values.folderId,
                    oauthEmail: values.oauthEmail,
                    notifyEmail: values.notifyEmail
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                message.success(data.message || 'Kiểm tra kết nối thành công!');
                if (data.folderUrl) {
                    window.open(data.folderUrl, '_blank');
                }
            } else {
                message.error(data.error || 'Kiểm tra kết nối thất bại!');
            }
        } catch (err: any) {
            message.error(err.message || 'Lỗi kiểm tra kết nối');
        } finally {
            setTesting(false);
        }
    };

    // Lưu cấu hình
    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            const basePath = getBasePath();
            const res = await fetch(`${basePath}/api/staff/attendance/drive-sync/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'DEPARTMENT',
                    targetId: ma_khoa,
                    method: activeMethod,
                    ...values
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                message.success('Đã lưu cấu hình Google Drive thành công!');
                onClose();
            } else {
                message.error(data.error || 'Lỗi khi lưu cấu hình');
            }
        } catch (err: any) {
            message.error(err.message || 'Vui lòng điền đủ thông tin');
        } finally {
            setLoading(false);
        }
    };

    const tabItems = [
        {
            key: 'APPS_SCRIPT',
            label: (
                <span className="font-semibold text-xs flex items-center gap-1.5">
                    <ThunderboltOutlined className="text-amber-500" />
                    <span>1. Webhook Apps Script (Khuyên dùng)</span>
                </span>
            ),
            children: (
                <div className="space-y-3 pt-1">
                    <Alert
                        type="info"
                        showIcon
                        message="Phương thức đơn giản, độc lập và an toàn nhất cho từng khoa/phòng"
                        description="Không cần tài khoản Google Cloud phức tạp. Bạn chỉ cần tạo 1 Apps Script ngắn trên Google Drive của mình, dán mã mẫu và lấy Webhook URL dán vào đây."
                    />

                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center justify-between">
                            <span>📄 Mã Google Apps Script mẫu:</span>
                            <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={handleCopyScript}
                                type="primary"
                                className="bg-blue-600 text-xs"
                            >
                                Copy mã mẫu
                            </Button>
                        </div>
                        <p className="text-slate-500 mb-0">
                            Mã này tự động tạo thư mục <code>ChamCong_BVDKLS/[TênKhoa]/Nam_2026/Thang_11</code> trên Drive của bạn và lưu đủ 5 file Excel chuẩn mẫu.
                        </p>
                    </div>

                    <Collapse
                        size="small"
                        defaultActiveKey={['script_guide']}
                        className="bg-amber-50/50 border-amber-200 text-xs"
                        items={[
                            {
                                key: 'script_guide',
                                label: <span className="font-semibold text-amber-900">📖 Xem hướng dẫn 4 bước lấy Webhook URL trên Google Drive (chỉ mất 1 phút)</span>,
                                children: (
                                    <div className="space-y-2 text-xs text-slate-700">
                                        <div>
                                            <strong>Bước 1:</strong> Bấm nút <strong>"Copy mã mẫu"</strong> ở trên, sau đó truy cập <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">https://script.google.com</a> (đăng nhập bằng Gmail của bạn/khoa).
                                        </div>
                                        <div>
                                            <strong>Bước 2:</strong> Nhấn nút <strong>"Dự án mới" (New project)</strong>. Xóa hết mã mặc định <code>function myFunction() &#123;&#125;</code> và <strong>Dán toàn bộ mã vừa copy</strong> vào.
                                        </div>
                                        <div>
                                            <strong>Bước 3:</strong> Nhấn nút <strong>Triển khai (Deploy)</strong> ở góc trên bên phải &gt; chọn <strong>Triển khai mới (New deployment)</strong>:
                                            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-600">
                                                <li>Nhấn biểu tượng bánh răng ⚙️ bên cạnh "Chọn loại" &gt; chọn <strong>Ứng dụng web (Web app)</strong>.</li>
                                                <li><strong>Mô tả:</strong> Lưu Excel Chấm Công BVĐK Lạng Sơn.</li>
                                                <li><strong>Thực thi dưới dạng (Execute as):</strong> <u>Tôi (Me - email của bạn)</u>.</li>
                                                <li><strong>Người có quyền truy cập (Who has access):</strong> <u>Bất kỳ ai (Anyone)</u>. <em>(Rất quan trọng để hệ thống có thể gửi file qua)</em>.</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <strong>Bước 4:</strong> Nhấn <strong>Triển khai (Deploy)</strong> &gt; Google sẽ yêu cầu cấp quyền:
                                            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-600">
                                                <li>Chọn tài khoản Google của bạn &gt; Nhấn <strong>Nâng cao (Advanced)</strong> &gt; Nhấn <strong>Đi tới... (không an toàn) / Go to ... (unsafe)</strong> &gt; Nhấn <strong>Cho phép (Allow)</strong>.</li>
                                                <li>Sao chép đường link <strong>"URL ứng dụng web"</strong> (có đuôi kết thúc bằng <code>/exec</code>) và dán vào ô bên dưới.</li>
                                            </ul>
                                        </div>
                                    </div>
                                )
                            }
                        ]}
                    />

                    <Form.Item
                        name="webhookUrl"
                        label={<span className="font-bold text-xs">Webhook URL của Google Apps Script</span>}
                        rules={[{ required: activeMethod === 'APPS_SCRIPT', message: 'Vui lòng nhập Webhook URL!' }]}
                        help="Đường dẫn bắt đầu bằng https://script.google.com/macros/s/.../exec"
                    >
                        <Input
                            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                            className="font-mono text-xs"
                        />
                    </Form.Item>

                    <div className="flex justify-end">
                        <Button
                            icon={<CheckCircleOutlined />}
                            onClick={handleTestConnection}
                            loading={testing}
                            className="text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        >
                            Kiểm tra kết nối Webhook
                        </Button>
                    </div>
                </div>
            )
        },
        {
            key: 'OAUTH',
            label: (
                <span className="font-semibold text-xs flex items-center gap-1.5">
                    <SafetyCertificateOutlined className="text-blue-500" />
                    <span>2. Đăng nhập Google Drive (OAuth 2.0)</span>
                </span>
            ),
            children: (
                <div className="space-y-3 pt-1">
                    <Alert
                        type="info"
                        showIcon
                        message="Liên kết trực tiếp tài khoản Google Drive cá nhân"
                        description="Dành cho tài khoản muốn ủy quyền lưu trữ trực tiếp vào Google Drive mà không cần tự tạo Apps Script."
                    />

                    <Form.Item
                        name="oauthEmail"
                        label={<span className="font-bold text-xs">Địa chỉ Gmail Google Drive liên kết</span>}
                    >
                        <Input placeholder="ví dụ: truongkhoa.cntt@gmail.com" />
                    </Form.Item>

                    <Form.Item
                        name="folderId"
                        label={<span className="font-bold text-xs">ID Thư mục trên Google Drive (Tùy chọn)</span>}
                        help="Để trống hệ thống sẽ tự động tạo thư mục gốc 'ChamCong_BVDKLS' trên Drive của bạn."
                    >
                        <Input placeholder="Ví dụ: 1a2B3c4D5e6F7g..." className="font-mono text-xs" />
                    </Form.Item>
                </div>
            )
        },
        {
            key: 'SERVICE_ACCOUNT',
            label: (
                <span className="font-semibold text-xs flex items-center gap-1.5">
                    <FolderOpenOutlined className="text-purple-500" />
                    <span>3. Drive tập trung của Bệnh viện</span>
                </span>
            ),
            children: (
                <div className="space-y-3 pt-1">
                    <Alert
                        type="info"
                        showIcon
                        message="Lưu trữ tự động về kho dữ liệu Google Drive chung của Bệnh viện"
                        description="Hệ thống sẽ tự động lưu 5 file Excel vào thư mục của khoa này trên Google Drive bệnh viện và tự động gửi thông báo/chia sẻ quyền xem cho email của Trưởng khoa."
                    />

                    <Form.Item
                        name="notifyEmail"
                        label={<span className="font-bold text-xs">Email Trưởng khoa / Người phụ trách nhận chia sẻ</span>}
                        rules={[{ required: activeMethod === 'SERVICE_ACCOUNT', message: 'Vui lòng nhập email nhận chia sẻ!' }]}
                        help="Hệ thống sẽ cấp quyền xem (Viewer) thư mục backup cho địa chỉ email này."
                    >
                        <Input placeholder="truongkhoa@gmail.com" />
                    </Form.Item>

                    <Form.Item
                        name="centralFolderId"
                        label={<span className="font-bold text-xs">ID Thư mục Lưu trữ Khoa Phòng (Tùy chọn)</span>}
                    >
                        <Input placeholder="Để trống dùng thư mục cấu hình toàn viện" className="font-mono text-xs" />
                    </Form.Item>
                </div>
            )
        }
    ];

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800 text-base font-bold pb-2 border-b">
                    <CloudSyncOutlined className="text-blue-600 text-xl" />
                    <span>Cấu hình Sao lưu & Đồng bộ Google Drive - {deptName}</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={720}
            footer={[
                <Button key="close" onClick={onClose}>
                    Đóng
                </Button>,
                <Button key="save" type="primary" onClick={handleSave} loading={loading} className="bg-blue-600">
                    Lưu Cấu Hình
                </Button>
            ]}
        >
            <Form form={form} layout="vertical" className="pt-2">
                <div className="flex items-center justify-between p-2 bg-slate-50 border rounded mb-3">
                    <div>
                        <div className="font-bold text-xs text-slate-800">Kích hoạt tính năng đồng bộ Google Drive</div>
                        <div className="text-[11px] text-slate-500">Bật để cho phép xuất và sao lưu 5 bảng Excel lên Google Drive đám mây.</div>
                    </div>
                    <Form.Item name="isEnabled" valuePropName="checked" className="mb-0">
                        <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
                    </Form.Item>
                </div>

                <div className="flex items-center justify-between p-2 bg-blue-50/60 border border-blue-200 rounded mb-3">
                    <div>
                        <div className="font-bold text-xs text-blue-900">Tự động sao lưu lên Drive khi Khóa Bảng Chấm Công Tháng</div>
                        <div className="text-[11px] text-blue-700">Khi Trưởng khoa khóa công, hệ thống tự động lưu 1 bản snapshot lưu trữ vĩnh viễn trên Drive.</div>
                    </div>
                    <Form.Item name="autoSyncOnLock" valuePropName="checked" className="mb-0">
                        <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
                    </Form.Item>
                </div>

                <div className="font-bold text-xs text-slate-700 mb-1.5 flex items-center gap-1">
                    <span>Chọn phương thức kết nối Google Drive:</span>
                </div>

                <Tabs
                    activeKey={activeMethod}
                    onChange={(k) => setActiveMethod(k as any)}
                    items={tabItems}
                    type="card"
                />

                {/* Thông tin lần đồng bộ gần nhất */}
                {lastSyncInfo?.lastSyncAt && (
                    <div className="mt-4 p-2 bg-slate-50 border rounded text-xs flex items-center justify-between">
                        <div>
                            <span className="text-slate-500">Đồng bộ gần nhất: </span>
                            <strong>{new Date(lastSyncInfo.lastSyncAt).toLocaleString('vi-VN')}</strong>
                            <Tag
                                color={lastSyncInfo.lastSyncStatus === 'SUCCESS' ? 'success' : 'error'}
                                className="ml-2 font-bold text-[10px]"
                            >
                                {lastSyncInfo.lastSyncStatus === 'SUCCESS' ? 'THÀNH CÔNG' : 'THẤT BẠI'}
                            </Tag>
                        </div>
                        {lastSyncInfo.lastSyncFolderUrl && (
                            <a
                                href={lastSyncInfo.lastSyncFolderUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                            >
                                <FolderOpenOutlined /> Mở thư mục trên Drive
                            </a>
                        )}
                    </div>
                )}
            </Form>
        </Modal>
    );
}
