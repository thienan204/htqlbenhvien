'use client';

import React from 'react';
import { Card, Row, Col, Tag, Typography, Alert, Table, Divider } from 'antd';
import {
    BookOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    WarningOutlined,
    InfoCircleOutlined,
    SafetyCertificateOutlined,
    CalculatorOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;

interface RuleMatrixItem {
    key: string;
    groupName: string;
    tagColor: string;
    timeCondition: string;
    rvCondition: string;
    formula: string;
    formulaDesc: string;
    note: string;
}

const ruleMatrixData: RuleMatrixItem[] = [
    {
        key: '1',
        groupName: 'Nhóm 1: Nằm ≤ 4 giờ (Điểm d)',
        tagColor: 'default',
        timeCondition: 'T ≤ 240 phút (≤ 4 giờ tính từ NGAY_VAO_NOI_TRU đến NGAY_RA)',
        rvCondition: 'Mọi kết quả điều trị / loại ra viện (kể cả cấp cứu, tử vong, chuyển viện ≤ 4h)',
        formula: 'S_chuẩn = 0 ngày',
        formulaDesc: 'Không được thanh toán tiền ngày giường BHYT',
        note: 'Theo Điểm d và Điểm c đoạn 2 Điều 6: Không tính tiền ngày giường nội trú; nếu điều trị nội trú dưới 4h cần chuyển sang mã 09'
    },
    {
        key: '2',
        groupName: 'Nhóm 2: > 4h đến < 24h (Điểm c)',
        tagColor: 'blue',
        timeCondition: '240 phút < T < 1440 phút (trong cùng ngày hoặc vào hôm trước ra hôm sau)',
        rvCondition: 'Mọi kết quả điều trị / loại ra viện',
        formula: 'S_chuẩn = 1 ngày',
        formulaDesc: 'Tính tròn 01 ngày điều trị',
        note: 'Theo Điểm c Điều 6: Vào và ra trong cùng ngày hoặc vào hôm trước ra hôm sau có thời gian điều trị trên 04h đến dưới 24h thì tính tròn 01 ngày điều trị'
    },
    {
        key: '3',
        groupName: 'Nhóm 3: Nằm ≥ 24h - Ra viện thường (Điểm b)',
        tagColor: 'green',
        timeCondition: 'T ≥ 1440 phút (≥ 24 giờ, lệch ≥ 1 ngày lịch tính từ NGAY_VAO_NOI_TRU)',
        rvCondition: 'Ra viện thông thường (không thuộc các trường hợp hưởng chế độ cộng ngày tại Điểm a)',
        formula: 'S_chuẩn = Ngày ra - Ngày vào NT',
        formulaDesc: 'Không tính ngày ra viện (chỉ tính ngày lịch chênh lệch)',
        note: 'Theo Điểm b Điều 6: Ví dụ vào nội trú 05/11, Ra 08/11 → S_chuẩn = 8 - 5 = 3 ngày. Kê 4 ngày bị xuất toán 1 ngày'
    },
    {
        key: '4',
        groupName: 'Nhóm 4: Nằm ≥ 24h - Tử vong / Chuyển tuyến / Nặng xin về (Điểm a)',
        tagColor: 'purple',
        timeCondition: 'T ≥ 1440 phút (≥ 24 giờ, lệch ≥ 1 ngày lịch tính từ NGAY_VAO_NOI_TRU)',
        rvCondition: 'Tử vong (5, 8), Tiên lượng nặng xin về (6), Chuyển viện tuyến trên/dưới (2), Bệnh nặng/chưa thuyên giảm xin về (3, 4 + RV=4)',
        formula: 'S_chuẩn = (Ngày ra - Ngày vào NT) + 1',
        formulaDesc: 'Được tính thêm ngày ra viện (+1 ngày)',
        note: 'Theo Điểm a Điều 6: Được hưởng thêm ngày ra viện (+1). Ví dụ vào nội trú 07/11, bệnh nặng xin về 09/11 → S_chuẩn = (9 - 7) + 1 = 3 ngày (hợp lệ 100%)'
    }
];

export default function BedDaysRulesGuide() {
    const columns: ColumnsType<RuleMatrixItem> = [
        {
            title: 'Nhóm Ca',
            dataIndex: 'groupName',
            key: 'groupName',
            width: 170,
            render: (text, record) => (
                <Tag color={record.tagColor} className="font-bold text-xs py-1 px-2.5">
                    {text}
                </Tag>
            )
        },
        {
            title: 'Điều kiện Thời gian (T)',
            dataIndex: 'timeCondition',
            key: 'timeCondition',
            width: 220,
            render: (text) => <span className="text-xs text-slate-700">{text}</span>
        },
        {
            title: 'Điều kiện Ra viện / Kết quả ĐT',
            dataIndex: 'rvCondition',
            key: 'rvCondition',
            width: 240,
            render: (text) => <span className="text-xs text-slate-700">{text}</span>
        },
        {
            title: 'Công thức Ngày giường Chuẩn',
            dataIndex: 'formula',
            key: 'formula',
            width: 210,
            render: (text, record) => (
                <div>
                    <div className="font-mono font-bold text-sm text-blue-700">{text}</div>
                    <div className="text-[11px] text-slate-500">{record.formulaDesc}</div>
                </div>
            )
        },
        {
            title: 'Quy tắc Kiểm soát & Hướng dẫn xử lý',
            dataIndex: 'note',
            key: 'note',
            render: (text) => <span className="text-xs text-slate-600 leading-relaxed">{text}</span>
        }
    ];

    return (
        <div className="space-y-5 p-1">
            {/* 1. Banner Căn cứ pháp lý */}
            <Alert
                title={
                    <div className="flex items-center gap-2 font-bold text-sm text-blue-900">
                        <SafetyCertificateOutlined className="text-blue-600 text-base" />
                        CĂN CỨ PHÁP LÝ & QUY TRÌNH GIÁM ĐỊNH BHYT
                    </div>
                }
                description={
                    <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Quy tắc đối chiếu số ngày giường điều trị nội trú dựa trên <strong>Điều 6 Thông tư 39/2018/TT-BYT</strong> (và Thông tư 22/2023/TT-BYT sửa đổi, bổ sung) của Bộ Y tế 
                        về xác định số ngày giường, áp dụng mức giá và thanh toán tiền ngày giường BHYT, kết hợp <strong>Quyết định 3618/QĐ-BHXH</strong> của BHXH Việt Nam 
                        và chuẩn dữ liệu XML <strong>Quyết định 130/QĐ-BYT</strong>. 
                        Mốc thời gian bắt đầu điều trị nội trú bắt buộc tính từ <strong>NGAY_VAO_NOI_TRU</strong> đến <strong>NGAY_RA</strong>, đối chiếu với tính chất ra viện để xác định chính xác số ngày giường chuẩn.
                    </div>
                }
                type="info"
                showIcon={false}
                className="rounded-2xl border-blue-200 bg-blue-50/60"
            />

            {/* 2. Bảng Ma trận 4 Nhóm Ca */}
            <Card
                className="rounded-2xl border-slate-200 shadow-sm"
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-base py-1">
                        <CalculatorOutlined className="text-blue-600" />
                        BẢNG MA TRẬN 4 NHÓM CA TÍNH SỐ NGÀY GIƯỜNG CHUẨN
                    </div>
                }
            >
                <Table
                    columns={columns}
                    dataSource={ruleMatrixData}
                    pagination={false}
                    bordered
                    size="small"
                />
            </Card>

            {/* 3. Chi tiết 4 Nhóm Ca với Minh họa trực quan */}
            <div>
                <div className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <BookOutlined className="text-purple-600" />
                    CHI TIẾT VÀ VÍ DỤ MINH HỌA TỪNG NHÓM CA
                </div>
                <Row gutter={[16, 16]}>
                    {/* Nhóm 1 */}
                    <Col span={12}>
                        <Card className="h-full rounded-2xl border-slate-200 shadow-sm hover:shadow transition-shadow bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <Tag color="default" className="font-bold text-xs px-2.5 py-0.5">
                                    NHÓM 1: NẰM ≤ 4 GIỜ (≤ 240 PHÚT)
                                </Tag>
                                <span className="font-mono font-bold text-xs text-rose-600">S_chuẩn = 0 ngày</span>
                            </div>
                            <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                                <p>
                                    <strong>Điều kiện:</strong> Tổng thời gian nằm T = (NGAY_RA - NGAY_VAO) ≤ 240 phút (kể cả vào ra cùng ngày hay qua đêm).
                                </p>
                                <p>
                                    <strong>Quy định:</strong> Theo quy định thanh toán BHYT, người bệnh nằm điều trị không quá 04 giờ thì <strong>không được thanh toán tiền ngày giường</strong>.
                                </p>
                                <div className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600">
                                    <strong>Ví dụ thực tế:</strong> Vào 09/11/2026 06:52, Ra 09/11/2026 10:47 (T = 3.9h = 235 phút ≤ 240 phút) 
                                    → Giường chuẩn = 0 ngày. Nếu XML3 kê 1 ngày giường sẽ bị xuất toán 100%.
                                </div>
                                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                                    <WarningOutlined className="mr-1" />
                                    <strong>Lưu ý mã 09:</strong> Nếu hồ sơ đăng ký là Điều trị nội trú (MA_LOAI_KCB = 03) nhưng chỉ nằm ≤ 4 giờ, 
                                    bác sĩ cần hoàn tất thủ tục và đổi sang mã <strong>09 (Điều trị nội trú dưới 04 giờ)</strong>.
                                </div>
                            </div>
                        </Card>
                    </Col>

                    {/* Nhóm 2 */}
                    <Col span={12}>
                        <Card className="h-full rounded-2xl border-blue-200 shadow-sm hover:shadow transition-shadow bg-blue-50/30">
                            <div className="flex items-center justify-between mb-2">
                                <Tag color="blue" className="font-bold text-xs px-2.5 py-0.5">
                                    NHÓM 2: VÀO RA CÙNG NGÀY LỊCH (&gt; 4 GIỜ)
                                </Tag>
                                <span className="font-mono font-bold text-xs text-blue-700">S_chuẩn = 1 ngày</span>
                            </div>
                            <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                                <p>
                                    <strong>Điều kiện:</strong> Ngày vào và Ngày ra cùng 1 ngày lịch (ngày ra = ngày vào) và tổng thời gian nằm T &gt; 240 phút (&gt; 4 giờ).
                                </p>
                                <p>
                                    <strong>Quy định:</strong> Người bệnh vào và ra trong cùng ngày có thời gian nằm trên 4 giờ được <strong>tính tròn 1 ngày giường</strong>.
                                </p>
                                <div className="p-2 rounded-lg bg-white border border-blue-200 text-[11px] text-slate-600">
                                    <strong>Ví dụ thực tế:</strong> Vào 06/11/2026 07:30, Ra 06/11/2026 16:30 (T = 9h, cùng ngày 06/11) 
                                    → Giường chuẩn = 1 ngày. Nếu XML3 kê 2 ngày giường sẽ bị xuất toán 1 ngày.
                                </div>
                                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
                                    <CheckCircleOutlined className="mr-1" />
                                    <strong>Chuẩn xác:</strong> Hồ sơ chỉ được kê đúng 1 ngày giường nội trú (hoặc 1 ngày giường ban ngày mã 04).
                                </div>
                            </div>
                        </Card>
                    </Col>

                    {/* Nhóm 3 */}
                    <Col span={12}>
                        <Card className="h-full rounded-2xl border-emerald-200 shadow-sm hover:shadow transition-shadow bg-emerald-50/30">
                            <div className="flex items-center justify-between mb-2">
                                <Tag color="green" className="font-bold text-xs px-2.5 py-0.5">
                                    NHÓM 3: KHÁC NGÀY - RA VIỆN THÔNG THƯỜNG
                                </Tag>
                                <span className="font-mono font-bold text-xs text-emerald-700">S_chuẩn = Ngày ra - Ngày vào</span>
                            </div>
                            <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                                <p>
                                    <strong>Điều kiện:</strong> Nằm khác ngày lịch (Ngày ra &gt; Ngày vào), T &gt; 4 giờ, và ra viện thông thường (không chuyển viện, không tử vong).
                                </p>
                                <p>
                                    <strong>Quy định:</strong> Theo quy tắc giám định BHYT, ca ra viện bình thường <strong>không tính tiền giường ngày ra viện</strong>. 
                                    Công thức chuẩn: <code>S_chuẩn = Ngày ra - Ngày vào</code>.
                                </p>
                                <div className="p-2 rounded-lg bg-white border border-emerald-200 text-[11px] text-slate-600">
                                    <strong>Ví dụ thực tế:</strong> Vào 05/11/2026 04:15, Ra 08/11/2026 08:00 (lệch 3 ngày lịch: 5/11 → 8/11) 
                                    → Giường chuẩn = 8 - 5 = 3 ngày.
                                    <br />• Nếu XML3 kê 4 ngày: <strong>Xuất toán 1 ngày</strong>.
                                    <br />• Nếu XML3 kê 0 ngày: <strong>Thất thu viện phí 3 ngày</strong>.
                                </div>
                            </div>
                        </Card>
                    </Col>

                    {/* Nhóm 4 */}
                    <Col span={12}>
                        <Card className="h-full rounded-2xl border-purple-200 shadow-sm hover:shadow transition-shadow bg-purple-50/30">
                            <div className="flex items-center justify-between mb-2">
                                <Tag color="purple" className="font-bold text-xs px-2.5 py-0.5">
                                    NHÓM 4: KHÁC NGÀY - TỬ VONG / CHUYỂN TUYẾN
                                </Tag>
                                <span className="font-mono font-bold text-xs text-purple-700">S_chuẩn = (Ngày ra - Ngày vào) + 1</span>
                            </div>
                            <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                                <p>
                                    <strong>Điều kiện:</strong> Nằm khác ngày lịch (T &gt; 4h) và thuộc một trong hai trường hợp:
                                    <br />1. <code>KET_QUA_DTRI ∈ [5, 6, 8]</code> (Tử vong, Nặng xin về, Tử vong trước khi vào viện).
                                    <br />2. <code>MA_LOAI_RV = 2</code> (Chuyển cơ sở KBCB theo yêu cầu chuyên môn / Chuyển tuyến).
                                </p>
                                <p>
                                    <strong>Quy định:</strong> Người bệnh được <strong>tính thêm cả tiền giường ngày ra viện</strong> (+1 ngày so với Nhóm 3).
                                </p>
                                <div className="p-2 rounded-lg bg-white border border-purple-200 text-[11px] text-slate-600">
                                    <strong>Ví dụ thực tế:</strong> Vào 04/11/2026 20:00, Ra viện 12/11/2026 08:00 (chuyển viện MA_LOAI_RV = 2, lệch 8 ngày lịch) 
                                    → Giường chuẩn = (12 - 4) + 1 = <strong>9 ngày</strong>. 
                                    <br />• Nếu XML3 chỉ kê 8 ngày: <strong>Khoa bị thất thu 1 ngày viện phí</strong> do quên cộng ngày ra viện theo chế độ.
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>

            {/* 4. Quy định về Loại hình KCB và Mã Nhóm Dịch vụ */}
            <Card
                className="rounded-2xl border-slate-200 shadow-sm"
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <InfoCircleOutlined className="text-blue-600" />
                        QUY ĐỊNH VỀ LOẠI HÌNH KCB (MA_LOAI_KCB) & MÃ NHÓM DỊCH VỤ (MA_NHOM)
                    </div>
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                            <Tag color="cyan">MA_LOAI_KCB = 03</Tag> Điều trị nội trú
                        </div>
                        <p className="leading-relaxed text-slate-600">
                            Áp dụng đầy đủ quy tắc 4 nhóm ca nêu trên. Dịch vụ giường hợp lệ thuộc nhóm 14 (Giường điều trị nội trú) theo phê duyệt của Bộ Y tế.
                        </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                            <Tag color="red">MA_LOAI_KCB = 09</Tag> Điều trị nội trú dưới 04 giờ
                        </div>
                        <p className="leading-relaxed text-slate-600">
                            Bắt buộc <strong>S_chuẩn = 0 ngày</strong>. Nghiêm cấm kê giường điều trị nội trú nhóm 14. Bệnh viện chỉ được thu tiền khám, thuốc, VTYT, CLS theo quy định.
                        </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                            <Tag color="orange">MA_LOAI_KCB = 01, 02</Tag> Khám bệnh & Ngoại trú
                        </div>
                        <p className="leading-relaxed text-slate-600">
                            Tuyệt đối không được thanh toán giường nội trú nhóm 14. Trường hợp lưu theo dõi ngoại trú chỉ được dùng giường lưu (nhóm 15) theo quy định chuyên môn. Kê giường nội trú sẽ bị xuất toán 100%.
                        </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                            <Tag color="blue">MA_LOAI_KCB = 04</Tag> Điều trị nội trú ban ngày
                        </div>
                        <p className="leading-relaxed text-slate-600">
                            Thanh toán giường điều trị ban ngày nhóm 15 theo định mức thời gian điều trị trong ngày đã được phê duyệt trong danh mục kỹ thuật.
                        </p>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1.5 md:col-span-2">
                        <div className="font-bold text-blue-900 flex items-center gap-2">
                            <Tag color="purple">QUY TẮC LOẠI TRỪ ĐẶC BIỆT</Tag> 👶 Trẻ sơ sinh nằm ghép cùng mẹ (Nhóm mã Z38)
                        </div>
                        <p className="leading-relaxed text-slate-700">
                            <strong>Thực tế nghiệp vụ:</strong> Trẻ sơ sinh sinh ra sống tại viện có <code>MA_BENH_CHINH</code> thuộc nhóm <strong>Z38</strong> (như <code>Z38.0, Z38.1, Z38.2...</code>) nằm ghép cùng mẹ (tiền giường đã tính cho mẹ). Hồ sơ XML của trẻ có ngày vào và ra viện nhưng <strong>không kê khai ngày giường trong XML3</strong>.
                            <br />
                            <strong>Cấu hình loại trừ trong Rules:</strong> Trong cấu hình quy tắc tại <code>/rules</code>, thiết lập <code>Trường điều kiện loại trừ: MA_BENH_CHINH</code> và <code>Giá trị loại trừ: Z38.0, Z38</code>. Khi hệ thống phát hiện hồ sơ có mã Z38 và không kê giường XML3, hệ thống sẽ xác nhận <strong>HỢP LỆ (ĐÚNG CHUẨN)</strong>, không bị báo nhầm là thiếu giường (thất thu viện phí).
                        </p>
                    </div>
                </div>

                <Divider className="my-3" />

                <div className="text-[11px] text-slate-500 leading-relaxed">
                    <strong>Nguồn dữ liệu đối chiếu XML:</strong>
                    <br />• <strong>XML1 (TONG_HOP):</strong> Đọc <code>NGAY_VAO</code>, <code>NGAY_RA</code>, <code>MA_LOAI_KCB</code>, <code>KET_QUA_DTRI</code>, <code>MA_LOAI_RV</code>, <code>MA_KHOA</code>.
                    <br />• <strong>XML7 (GIAY_RA_VIEN):</strong> Đọc <code>MA_KHOA_RV</code> để xác định chính xác khoa ra viện cuối cùng.
                    <br />• <strong>XML3 (CHI_TIET_DVKT):</strong> Lọc các dòng dịch vụ có <code>MA_NHOM</code> thuộc danh sách cấu hình (mặc định <code>14, 15</code>), tổng hợp <code>SO_LUONG</code> và <code>MA_KHOA</code> chỉ định thực tế.
                </div>
            </Card>
        </div>
    );
}

