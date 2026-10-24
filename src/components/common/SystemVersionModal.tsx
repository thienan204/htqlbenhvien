'use client';

import React from 'react';
import { Modal, Tabs, Tag, Timeline, Card, Button, Typography, Space, Divider } from 'antd';
import { 
    InfoCircleOutlined, HistoryOutlined, CustomerServiceOutlined, 
    CheckCircleFilled, RocketOutlined, PhoneOutlined, MailOutlined, SafetyCertificateFilled 
} from '@ant-design/icons';
import { SYSTEM_CONFIG, SYSTEM_CHANGELOG } from '@/config/systemVersion';
import { getBasePath } from '@/utils/config';

const { Text, Paragraph, Title } = Typography;

interface SystemVersionModalProps {
    open: boolean;
    onClose: () => void;
}

export default function SystemVersionModal({ open, onClose }: SystemVersionModalProps) {
    const tabItems = [
        {
            key: 'overview',
            label: (
                <span className="flex items-center gap-1.5 font-medium">
                    <RocketOutlined className="text-blue-500" />
                    Phiên bản hiện tại
                </span>
            ),
            children: (
                <div className="py-2 space-y-4">
                    {/* Header Card */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Bản phát hành chính thức
                                </span>
                                <h3 className="text-2xl font-black text-white mt-2 mb-1">
                                    {SYSTEM_CONFIG.version}
                                </h3>
                                <p className="text-blue-100 text-xs mb-0">
                                    Ngày cập nhật: {SYSTEM_CONFIG.releaseDate}
                                </p>
                            </div>
                            <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center text-3xl">
                                🏥
                            </div>
                        </div>
                    </div>

                    {/* App Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="text-[11px] text-slate-500 font-medium">Đơn vị chủ quản</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">{SYSTEM_CONFIG.hospitalName}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="text-[11px] text-slate-500 font-medium">Đơn vị vận hành</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">{SYSTEM_CONFIG.department}</div>
                        </div>
                    </div>

                    {/* Latest Highlights */}
                    {SYSTEM_CHANGELOG[0] && (
                        <div className="border border-slate-200 rounded-xl p-4 bg-white">
                            <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                <CheckCircleFilled className="text-emerald-500" />
                                Điểm mới nổi bật trong phiên bản {SYSTEM_CHANGELOG[0].version}:
                            </div>
                            <ul className="text-xs text-slate-600 space-y-1.5 pl-4 mb-0 list-disc">
                                {SYSTEM_CHANGELOG[0].highlights.map((hl, i) => (
                                    <li key={i}>{hl}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'changelog',
            label: (
                <span className="flex items-center gap-1.5 font-medium">
                    <HistoryOutlined className="text-amber-500" />
                    Lịch sử cập nhật
                </span>
            ),
            children: (
                <div className="py-2 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
                    <Timeline
                        mode="left"
                        items={SYSTEM_CHANGELOG.map((item, idx) => ({
                            color: idx === 0 ? 'green' : 'blue',
                            label: <span className="text-xs font-semibold text-slate-500">{item.releaseDate}</span>,
                            children: (
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-xs text-slate-800">{item.version} - {item.title}</span>
                                        {idx === 0 && <Tag color="success">Mới nhất</Tag>}
                                    </div>
                                    <p className="text-[11px] text-slate-600 mb-2">{item.description}</p>
                                    <ul className="text-[11px] text-slate-500 space-y-1 pl-3.5 mb-1 list-disc">
                                        {item.highlights.map((h, hIdx) => (
                                            <li key={hIdx}>{h}</li>
                                        ))}
                                    </ul>
                                </div>
                            )
                        }))}
                    />
                </div>
            )
        },
        {
            key: 'support',
            label: (
                <span className="flex items-center gap-1.5 font-medium">
                    <CustomerServiceOutlined className="text-purple-500" />
                    Hỗ trợ kỹ thuật
                </span>
            ),
            children: (
                <div className="py-3 space-y-3">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="font-bold text-slate-800 text-sm mb-1">{SYSTEM_CONFIG.department}</div>
                        <p className="text-xs text-slate-600 mb-3">
                            Khi gặp sự cố kỹ thuật hoặc cần cấp quyền, hướng dẫn sử dụng, vui lòng liên hệ đầu mối CNTT:
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                                <PhoneOutlined className="text-blue-500" />
                                <span>Hotline / Số nội bộ: </span>
                                <span className="font-bold text-blue-600">{SYSTEM_CONFIG.supportHotline}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                                <MailOutlined className="text-amber-500" />
                                <span>Hòm thư hỗ trợ: </span>
                                <span className="font-bold text-slate-700">{SYSTEM_CONFIG.supportEmail}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={
                <div className="flex justify-end">
                    <Button type="primary" onClick={onClose} className="rounded-xl px-5">
                        Đóng
                    </Button>
                </div>
            }
            centered
            width={580}
            title={
                <div className="flex items-center gap-2.5 text-slate-800 text-base font-bold">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                        <InfoCircleOutlined />
                    </div>
                    <div>
                        <div>Thông tin Hệ thống & Phiên bản</div>
                        <div className="text-xs font-normal text-slate-500">{SYSTEM_CONFIG.appName}</div>
                    </div>
                </div>
            }
        >
            <div className="pt-2">
                <Tabs type="card" items={tabItems} className="custom-card-tabs" />
            </div>
        </Modal>
    );
}
