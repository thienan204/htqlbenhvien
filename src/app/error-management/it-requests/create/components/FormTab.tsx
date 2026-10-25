import React, { useState, useRef, useEffect } from 'react';
import { Form, Input, Select, Radio, Button, Card, Upload, Switch, Alert, Tag, Segmented, message } from 'antd';
import { PictureOutlined, CameraOutlined, LoadingOutlined, FileTextOutlined, DesktopOutlined, AimOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { getBasePath } from '@/utils/config';
import { useCheckBa } from '../hooks/useCheckBa';
import { BaPaymentStatusAlert } from './BaPaymentStatusAlert';
import { DetectedLinkBar } from '@/components/common/LinkifiedText';

interface FormTabProps {
    form: any;
    handleCreateTicket: (values: any) => void;
    isAdmin: boolean;
    isManager: boolean;
    softwareErrors: string[];
    hardwareErrors: string[];
    departments: any[];
    departmentStaff: any[];
    setDepartmentStaff: (staff: any[]) => void;
    allStaffs: any[];
    itUsers: any[];
    user: any;
    savedStaffId?: string | null;
    setSavedStaffId: (id: string | null) => void;
    fileList: any[];
    uploadProps: any;
    loading: boolean;
    targetDepartment?: string;
    maBaLength?: number;
    activeCategory?: 'SOFTWARE' | 'HARDWARE';
}

export function FormTab({
    form,
    handleCreateTicket,
    isAdmin,
    isManager,
    softwareErrors,
    hardwareErrors,
    departments,
    departmentStaff,
    setDepartmentStaff,
    allStaffs,
    itUsers,
    user,
    savedStaffId,
    setSavedStaffId,
    fileList,
    uploadProps,
    loading,
    targetDepartment = 'CNTT',
    maBaLength = 11,
    activeCategory
}: FormTabProps) {
    const [inputMaBa, setInputMaBa] = useState<string>('');
    const { baCode, baInfo, hasPaymentRequest, isChecking, isFound, triggerCheck } = useCheckBa(inputMaBa);
    const watchedGhiChu = Form.useWatch('ghi_chu', form);

    useEffect(() => {
        if (savedStaffId && !form.getFieldValue('nguoi_bao_id')) {
            form.setFieldsValue({ nguoi_bao_id: savedStaffId });
        }
    }, [savedStaffId]);

    // Tự động chuyển trạng thái "Đã ra viện" nếu hồ sơ đã có ngày ra viện
    useEffect(() => {
        if (baInfo && baInfo.ngayRa) {
            if (form.getFieldValue('trang_thai_ba') === 'Đang điều trị') {
                form.setFieldsValue({ trang_thai_ba: 'Đã ra viện' });
            }
        }
    }, [baInfo]);

    const lastPasteTimeRef = useRef<number>(0);

    const handlePaste = (e: React.ClipboardEvent) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const items = clipboardData.items;
        if (!items || items.length === 0) return;

        // Thu thập các file ảnh hợp lệ từ clipboard
        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    // Chống trùng lặp do clipboard cung cấp nhiều MIME type cho cùng một ảnh
                    const isDup = imageFiles.some(f => f.size === file.size);
                    if (!isDup) {
                        imageFiles.push(file);
                    }
                }
            }
        }

        if (imageFiles.length === 0) return;

        // Chặn nổi bọt sự kiện lên thẻ cha và chặn trình duyệt chèn dữ liệu text rác
        e.stopPropagation();
        e.preventDefault();

        // Chống kích hoạt đúp (debounce guard 500ms)
        const now = Date.now();
        if (now - lastPasteTimeRef.current < 500) {
            return;
        }
        lastPasteTimeRef.current = now;

        const pad = (n: number) => String(n).padStart(2, '0');
        const d = new Date();
        const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

        imageFiles.forEach((file, index) => {
            const ext = (file.type.split('/')[1] || 'png').replace('+xml', '');
            const customFileName = `anh_dan_${timeStr}_${index + 1}.${ext}`;
            const renamedFile = new File([file], customFileName, { type: file.type });
            if (uploadProps && uploadProps.customRequest) {
                uploadProps.customRequest({ file: renamedFile });
            }
        });

        message.success(`Đã dán và đính kèm ${imageFiles.length} ảnh chụp màn hình!`);
    };

    const normalizeString = (str: string) => {
        return (str || '')
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .toLowerCase()
            .trim();
    };

    const getInitials = (str: string) => {
        const normalized = normalizeString(str);
        return normalized.replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('');
    };

    const onMaBaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        // Tự động viết hoa 2 ký tự đầu 'ba' hoặc 'Ba' thành 'BA'
        if (/^ba/i.test(val)) {
            val = 'BA' + val.slice(2);
            form.setFieldsValue({ ma_ba: val });
        }
        setInputMaBa(val);
    };

    return (
        <Card className="shadow-sm rounded-b-2xl rounded-tr-2xl border-slate-200 border-t-0">
            <Form 
                form={form} 
                layout="vertical" 
                onFinish={(vals) => handleCreateTicket({ ...vals, category: activeCategory || vals.category || (targetDepartment === 'CNTT' ? 'SOFTWARE' : 'HARDWARE') })}
                initialValues={{ 
                    category: activeCategory || (targetDepartment === 'CNTT' ? 'SOFTWARE' : 'HARDWARE'),
                    trang_thai_ba: 'Đang điều trị',
                    nguoi_bao_id: savedStaffId || undefined,
                    selfAssign: false
                }}
            >
                <Form.Item name="category" hidden>
                    <Input />
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
                    {({ getFieldValue }) => {
                        const isSoftware = activeCategory ? activeCategory === 'SOFTWARE' : (targetDepartment === 'CNTT' ? getFieldValue('category') === 'SOFTWARE' : false);
                        const isITStaff = user?.role === targetDepartment || user?.role === 'ADMIN';
                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
                                {/* CỘT TRÁI (7/12): NỘI DUNG SỰ CỐ & HÌNH ẢNH */}
                                <div className="lg:col-span-7 space-y-5">
                                    {/* 1. KHỐI THÔNG TIN SỰ CỐ (BỆNH ÁN HOẶC PHẦN CỨNG) */}
                                    <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-2xs">
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                                            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm tracking-wide uppercase">
                                                {isSoftware ? (
                                                    <>
                                                        <FileTextOutlined className="text-blue-600 text-base" />
                                                        <span>Thông tin Bệnh Án & Sự cố phần mềm</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <DesktopOutlined className="text-amber-600 text-base" />
                                                        <span>Sự cố Thiết bị & Phần cứng</span>
                                                    </>
                                                )}
                                            </div>
                                            {isSoftware && (
                                                <span className="text-xs text-blue-700 font-medium bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                                                    HIS / EMR / BHYT
                                                </span>
                                            )}
                                        </div>

                                        {isSoftware ? (
                                            <>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <Form.Item 
                                                        name="ma_ba" 
                                                        label={
                                                            <span className="font-semibold text-slate-800 flex items-center gap-2 text-xs sm:text-sm">
                                                                Mã Bệnh Án
                                                                {isChecking && <LoadingOutlined className="text-blue-500 text-xs ml-1" />}
                                                            </span>
                                                        } 
                                                        rules={[{ required: true, message: 'Vui lòng nhập mã bệnh án' }]} 
                                                        className="mb-0"
                                                    >
                                                        <Input 
                                                            size="large"
                                                            placeholder="VD: BA001028282" 
                                                            maxLength={maBaLength || 11}
                                                            className="!rounded-xl font-mono text-[14px] font-semibold tracking-wide !h-11 border-slate-300 shadow-2xs"
                                                            onChange={onMaBaChange}
                                                            onBlur={(e) => triggerCheck(e.target.value)}
                                                            allowClear
                                                        />
                                                    </Form.Item>

                                                    <Form.Item 
                                                        name="trang_thai_ba" 
                                                        label={<span className="font-semibold text-slate-800 text-xs sm:text-sm">Trạng thái bệnh án</span>} 
                                                        className="mb-0"
                                                    >
                                                        <Segmented 
                                                            block
                                                            size="large"
                                                            className="w-full !h-11 p-1 bg-slate-200/70 rounded-xl font-medium text-[13px] border border-slate-200/80 flex items-center"
                                                            options={[
                                                                { label: '🏥 Đang điều trị', value: 'Đang điều trị' },
                                                                { label: '📋 Đã ra viện', value: 'Đã ra viện' }
                                                            ]}
                                                        />
                                                    </Form.Item>
                                                </div>

                                                <BaPaymentStatusAlert
                                                    baCode={baCode || inputMaBa}
                                                    baInfo={baInfo}
                                                    hasPaymentRequest={hasPaymentRequest}
                                                    isChecking={isChecking}
                                                    isFound={isFound}
                                                />
                                                
                                                <Form.Item 
                                                    name="ten_loi_software" 
                                                    label={<span className="font-semibold text-slate-800 text-xs sm:text-sm">Vấn đề cần hỗ trợ (Lỗi nghiệp vụ)</span>} 
                                                    rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập vấn đề' }]} 
                                                    className="mb-0"
                                                >
                                                    <Select 
                                                        mode="tags" 
                                                        size="large"
                                                        className="!rounded-xl"
                                                        placeholder="Chọn trong danh sách hoặc gõ thêm lỗi cần hỗ trợ..." 
                                                        options={(softwareErrors || [])
                                                            .map((e: any) => typeof e === 'string' ? e : e?.name)
                                                            .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
                                                            .map(e => ({ label: e, value: e }))} 
                                                    />
                                                </Form.Item>
                                            </>
                                        ) : (
                                            <Form.Item 
                                                name="ten_loi_hardware" 
                                                label={<span className="font-semibold text-slate-800 text-xs sm:text-sm">Chọn sự cố cần sửa chữa</span>} 
                                                rules={[{ required: true, message: 'Vui lòng chọn sự cố' }]} 
                                                className="mb-0"
                                            >
                                                <Radio.Group className="!flex !flex-wrap gap-2 sm:gap-2.5 items-center">
                                                    {(hardwareErrors || [])
                                                        .map((t: any) => typeof t === 'string' ? t : t?.name)
                                                        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
                                                        .map((t: string) => (
                                                        <Radio.Button 
                                                            key={t} 
                                                            value={t} 
                                                            className="!inline-flex !items-center !justify-center !rounded-xl !h-10 px-4 !text-[13px] font-medium transition-all shadow-2xs hover:border-amber-400"
                                                        >
                                                            {t}
                                                        </Radio.Button>
                                                    ))}
                                                </Radio.Group>
                                            </Form.Item>
                                        )}
                                    </div>

                                    {/* 2. KHỐI MÔ TẢ CHI TIẾT & HÌNH ẢNH */}
                                    <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-2xs">
                                        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm tracking-wide uppercase pb-3 border-b border-slate-200/80">
                                            <PictureOutlined className="text-slate-600 text-base" />
                                            <span>Mô tả chi tiết & Hình ảnh đính kèm</span>
                                        </div>

                                        <Form.Item name="ghi_chu" label={<span className="font-semibold text-slate-800 text-xs sm:text-sm">Ghi chú thêm / Mô tả cụ thể (Tùy chọn)</span>} className="mb-0">
                                            <Input.TextArea 
                                                rows={3} 
                                                className="!rounded-xl text-sm" 
                                                onPaste={handlePaste}
                                                placeholder="Mô tả cụ thể hoặc cho biết vị trí máy bị lỗi... (Có thể dán trực tiếp ảnh chụp Ctrl+V vào đây)" 
                                            />
                                        </Form.Item>

                                        {/* Hiển thị các liên kết phát hiện được trong ghi chú để click mở ngay */}
                                        <DetectedLinkBar text={watchedGhiChu} />

                                        <Form.Item label={<span className="font-semibold text-slate-800 text-xs sm:text-sm">Đính kèm ảnh minh họa lỗi</span>} className="mb-0">
                                            <div className="flex flex-col gap-3" onPaste={handlePaste}>
                                                <div className="hidden sm:block">
                                                    <Upload {...uploadProps}>
                                                        {fileList.length >= 3 ? null : (
                                                            <div className="flex flex-col items-center justify-center text-slate-500 py-1">
                                                                <PictureOutlined className="text-xl mb-1 text-slate-400" />
                                                                <div className="text-xs">Tải ảnh lên</div>
                                                            </div>
                                                        )}
                                                    </Upload>
                                                </div>
                                                
                                                {/* Giao diện Upload/Chụp ảnh cho Mobile */}
                                                <div className="sm:hidden flex flex-col gap-2.5">
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 relative overflow-hidden bg-white text-blue-600 rounded-xl border border-slate-200 hover:bg-blue-50 transition-colors flex items-center justify-center p-2.5 cursor-pointer text-xs font-semibold shadow-xs">
                                                            <PictureOutlined className="mr-1.5" /> <span>Thư viện</span>
                                                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                                                if(e.target.files && e.target.files.length > 0) {
                                                                    const fileObj = e.target.files[0];
                                                                    uploadProps.customRequest({ file: fileObj });
                                                                }
                                                                e.target.value = '';
                                                            }} />
                                                        </div>
                                                        <div className="flex-1 relative overflow-hidden bg-white text-emerald-600 rounded-xl border border-slate-200 hover:bg-emerald-50 transition-colors flex items-center justify-center p-2.5 cursor-pointer text-xs font-semibold shadow-xs">
                                                            <CameraOutlined className="mr-1.5" /> <span>Chụp ảnh</span>
                                                            <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                                                if(e.target.files && e.target.files.length > 0) {
                                                                    const fileObj = e.target.files[0];
                                                                    uploadProps.customRequest({ file: fileObj });
                                                                }
                                                                e.target.value = '';
                                                            }} />
                                                        </div>
                                                    </div>
                                                    {fileList.length > 0 && (
                                                        <Upload {...uploadProps} />
                                                    )}
                                                </div>
                                            </div>
                                        </Form.Item>
                                    </div>
                                </div>

                                {/* CỘT PHẢI (5/12): THÔNG TIN NGƯỜI GỬI & ĐIỀU PHỐI IT */}
                                <div className="lg:col-span-5 space-y-5">
                                    {/* 1. THÔNG TIN NGƯỜI GỬI */}
                                    <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-2xs">
                                        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm tracking-wide uppercase pb-3 border-b border-slate-200/80">
                                            <span>👤</span>
                                            <span>Thông tin người gửi yêu cầu</span>
                                        </div>

                                        {isAdmin && (
                                            <Form.Item name="ma_khoa" label={<span className="font-semibold text-slate-800 text-xs sm:text-sm">Khoa / Phòng yêu cầu</span>} rules={[{ required: true, message: 'Vui lòng chọn khoa' }]} className="mb-0">
                                                <Select
                                                    showSearch
                                                    size="large"
                                                    className="!rounded-xl"
                                                    placeholder="Chọn khoa phòng (hoặc gõ tắt: knth)"
                                                    virtual={false}
                                                    filterOption={(input, option) => {
                                                        if (!input) return true;
                                                        const search = normalizeString(input);
                                                        const label = String((option as any)?.searchtext || (option as any)?.children || '');
                                                        const normLabel = normalizeString(label);
                                                        const initials = getInitials(label);
                                                        return normLabel.includes(search) || initials.includes(search);
                                                    }}
                                                    onChange={(val) => {
                                                        setDepartmentStaff(allStaffs.filter((s: any) => s.ma_khoa === val));
                                                        form.setFieldsValue({ nguoi_bao_id: undefined });
                                                    }}
                                                >
                                                    {departments.map((d: any) => (
                                                        <Select.Option key={d.ma_khoa} value={d.ma_khoa} searchtext={d.ten_khoa}>
                                                            {d.ten_khoa}
                                                        </Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                        )}

                                        <Form.Item name="nguoi_bao_id" label={<span className="font-semibold text-slate-800 text-xs sm:text-sm">Cán bộ y tế báo sự cố</span>} rules={[{ required: true, message: 'Vui lòng chọn tên' }]} className="mb-0">
                                            <Select 
                                                showSearch 
                                                size="large"
                                                className="!rounded-xl"
                                                placeholder="Tìm tên nhân viên (hoặc gõ tắt: btq)..." 
                                                virtual={false}
                                                disabled={!!user?.staffId && !isAdmin && user?.role !== 'KHOA'}
                                                filterOption={(input, option) => {
                                                    if (!input) return true;
                                                    const search = normalizeString(input);
                                                    const optVal = String(option?.value || '').toLowerCase();
                                                    if (optVal === search || optVal.includes(search)) return true;

                                                    const fullText = String((option as any)?.searchtext || (option as any)?.children || '');
                                                    const staffName = String((option as any)?.staffname || '');
                                                    
                                                    const normFull = normalizeString(fullText);
                                                    if (normFull.includes(search)) return true;

                                                    const fullInitials = getInitials(fullText);
                                                    if (fullInitials.includes(search)) return true;

                                                    if (staffName) {
                                                        const nameInitials = getInitials(staffName);
                                                        if (nameInitials.includes(search)) return true;
                                                    }

                                                    return false;
                                                }}
                                                onChange={(val) => {
                                                    if (!user?.staffId || isAdmin || user?.role === 'KHOA') {
                                                        localStorage.setItem('last_it_request_staff_id', val);
                                                        setSavedStaffId(val);
                                                    }
                                                }}
                                            >
                                                {departmentStaff.map((s: any) => {
                                                    const labelText = `${s.ho_ten}${s.chuc_danh ? ` (${s.chuc_danh})` : ''}${isAdmin ? ` - ${s.department?.ten_khoa || s.ma_khoa}` : ''}`;
                                                    return (
                                                        <Select.Option key={s.id} value={s.id} searchtext={labelText} staffname={s.ho_ten}>
                                                            {labelText}
                                                        </Select.Option>
                                                    );
                                                })}
                                            </Select>
                                        </Form.Item>
                                    </div>

                                    {/* 2. DÀNH CHO KỸ THUẬT VIÊN (TỰ NHẬN VIỆC) */}
                                    {isITStaff && (
                                        <div className="p-4 rounded-2xl border border-blue-200/80 bg-blue-50/50 flex items-center justify-between gap-3 shadow-2xs">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                                                    ⚡
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-blue-950 text-xs sm:text-sm">Tôi trực tiếp xử lý yêu cầu này</div>
                                                    <div className="text-[11px] text-slate-500 truncate">
                                                        Gán ngay cho <b>{user?.name || user?.username}</b>
                                                    </div>
                                                </div>
                                            </div>
                                            <Form.Item name="selfAssign" valuePropName="checked" noStyle>
                                                <Switch 
                                                    checkedChildren="Nhận" 
                                                    unCheckedChildren="Tắt"
                                                    className="bg-slate-300 shrink-0"
                                                    onChange={(checked) => {
                                                        if (checked) {
                                                            form.setFieldsValue({ assigneeId: user?.id });
                                                        } else if (!isManager) {
                                                            form.setFieldsValue({ assigneeId: undefined });
                                                        }
                                                    }}
                                                />
                                            </Form.Item>
                                        </div>
                                    )}

                                    {/* 3. DÀNH CHO QUẢN LÝ / TRƯỞNG PHÒNG */}
                                    {isManager && (
                                        <div className="bg-purple-50/50 p-4 sm:p-5 rounded-2xl border border-purple-200/80 space-y-3.5 shadow-2xs">
                                            <div className="flex items-center justify-between pb-2.5 border-b border-purple-100">
                                                <div className="font-bold text-purple-900 text-xs sm:text-sm flex items-center gap-1.5 uppercase">
                                                    <span>👑</span> Quản lý / Phân công
                                                </div>
                                                <Tag color="purple" className="m-0 font-medium text-[11px]">Chỉ đạo</Tag>
                                            </div>

                                            <Form.Item name="assigneeId" label={<span className="font-semibold text-xs text-purple-900">Chỉ định người xử lý (Giao việc)</span>} className="mb-0">
                                                <Select 
                                                    placeholder="Chọn nhân viên hoặc để tự động chia" 
                                                    allowClear
                                                    size="middle"
                                                    className="!rounded-xl"
                                                >
                                                    {itUsers.map((u: any) => {
                                                        let statusBadge = '';
                                                        if (u.autoAssignDisabled) {
                                                            statusBadge = `(🎯 Bận: ${u.focusReason || 'Việc riêng'})`;
                                                        } else if (!u.isAvailable) {
                                                            statusBadge = '(🔴 Tắt)';
                                                        }
                                                        return (
                                                            <Select.Option key={u.id} value={u.id}>
                                                                {u.name || u.username} {statusBadge}
                                                            </Select.Option>
                                                        );
                                                    })}
                                                </Select>
                                            </Form.Item>

                                            <Form.Item name="ke_hoach" label={<span className="font-semibold text-xs text-purple-900">Kế hoạch / Chỉ đạo thực hiện</span>} className="mb-0">
                                                <Input.TextArea rows={2} placeholder="Thời hạn hoặc hướng dẫn xử lý..." className="!rounded-xl text-xs" />
                                            </Form.Item>

                                            {/* Tùy chọn Đi khoa phòng */}
                                            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 transition-all">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <AimOutlined className="text-amber-600 text-sm shrink-0" />
                                                        <span className="font-bold text-amber-950 text-xs">Đi khoa phòng / Xử lý kéo dài</span>
                                                    </div>
                                                    <Form.Item name="isFocusTask" valuePropName="checked" noStyle>
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt"
                                                            size="small"
                                                            className="bg-slate-300 shrink-0"
                                                        />
                                                    </Form.Item>
                                                </div>

                                                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.isFocusTask !== cur.isFocusTask}>
                                                    {({ getFieldValue }) => {
                                                        const isFocus = getFieldValue('isFocusTask');
                                                        if (!isFocus) return null;
                                                        return (
                                                            <div className="mt-2.5 pt-2.5 border-t border-amber-200/80 space-y-2">
                                                                <Form.Item 
                                                                    name="focusReason" 
                                                                    label={<span className="text-[11px] font-semibold text-amber-900">Nhiệm vụ hiển thị</span>} 
                                                                    className="mb-0"
                                                                >
                                                                    <Input placeholder="Ví dụ: Triển khai EMR, Cài máy chủ..." className="!rounded-lg text-xs" />
                                                                </Form.Item>
                                                                <Form.Item 
                                                                    name="status" 
                                                                    label={<span className="text-[11px] font-semibold text-amber-900">Trạng thái phiếu</span>} 
                                                                    className="mb-0"
                                                                    initialValue="IN_PROGRESS"
                                                                >
                                                                    <Select size="small" className="!rounded-lg text-xs">
                                                                        <Select.Option value="IN_PROGRESS">Đang xử lý (Vào việc ngay)</Select.Option>
                                                                        <Select.Option value="PENDING">Chờ xử lý (Chờ tiếp nhận)</Select.Option>
                                                                    </Select>
                                                                </Form.Item>
                                                            </div>
                                                        );
                                                    }}
                                                </Form.Item>
                                            </div>
                                        </div>
                                    )}

                                    {/* 4. NÚT SUBMIT LỚN RÕ RÀNG */}
                                    <Button 
                                        type="primary" 
                                        htmlType="submit" 
                                        size="large" 
                                        className="w-full !h-12 !rounded-xl font-bold text-[15px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 transition-all cursor-pointer" 
                                        loading={loading}
                                    >
                                        Gửi Yêu Cầu Hỗ Trợ
                                    </Button>
                                </div>
                            </div>
                        );
                    }}
                </Form.Item>
            </Form>
        </Card>
    );
}
