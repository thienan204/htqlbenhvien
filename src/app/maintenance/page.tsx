import React from 'react';
import { Button, Result } from 'antd';
import { ToolOutlined, ArrowRightOutlined } from '@ant-design/icons';
import Link from 'next/link';

export const metadata = {
    title: 'Hệ thống đang bảo trì - Hệ thống Quản lý Bệnh viện',
};

export default function MaintenancePage() {
    return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5' }}>
            <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '600px', width: '100%', textAlign: 'center' }}>
                <Result
                    icon={<ToolOutlined style={{ color: '#faad14' }} />}
                    title={<h1 style={{ fontSize: '28px', color: '#333', marginBottom: '8px' }}>Hệ thống đang được bảo trì</h1>}
                    subTitle={
                        <div style={{ fontSize: '16px', color: '#555', marginTop: '16px' }}>
                            <p>Chúng tôi đang tiến hành nâng cấp hệ thống để mang lại trải nghiệm tốt hơn cho bạn.</p>
                            <p>Mong bạn thông cảm vì sự bất tiện này. Quá trình bảo trì sẽ sớm hoàn tất!</p>
                        </div>
                    }
                    extra={[
                        <div key="actions" style={{ marginTop: '24px' }}>
                            <Link href="/">
                                <Button type="primary" size="large" icon={<ArrowRightOutlined />}>
                                    Thử tải lại trang
                                </Button>
                            </Link>
                        </div>
                    ]}
                />
            </div>
        </div>
    );
}
