import React, { useState, useRef, useEffect } from 'react';
import { Select, Radio, Upload, Dropdown, Button, Input, Tooltip, message, Switch, Alert, Tag, Modal } from 'antd';
import { BugOutlined, PictureOutlined, CameraOutlined, AudioOutlined, SendOutlined, PaperClipOutlined, CheckOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { getBasePath } from '@/utils/config';
import { useCheckBa } from '../hooks/useCheckBa';
import { BaPaymentStatusAlert } from './BaPaymentStatusAlert';
import { DetectedLinkBar } from '@/components/common/LinkifiedText';

interface ChatTabProps {
    user: any;
    isAdmin: boolean;
    softwareErrors: string[];
    hardwareErrors: string[];
    departmentStaff: any[];
    departments: any[];
    savedStaffId: string | null;
    setSavedStaffId: (id: string | null) => void;
    fileList: any[];
    uploadProps: any;
    handleFileChange: (e: any) => void;
    uploadPendingFiles?: () => Promise<string[]>;
    uploadingFiles?: boolean;
    clearFiles?: () => void;
    form: any;
    setActiveTab: (tab: string) => void;
    targetDepartment?: string;
    maBaLength?: number;
    isManager?: boolean;
    itUsers?: any[];
}

export function ChatTab({
    user,
    isAdmin,
    softwareErrors,
    hardwareErrors,
    departmentStaff,
    departments,
    savedStaffId,
    setSavedStaffId,
    fileList,
    uploadProps,
    handleFileChange,
    uploadPendingFiles,
    uploadingFiles = false,
    clearFiles,
    setActiveTab,
    form,
    targetDepartment = 'CNTT',
    maBaLength = 11,
    isManager: isManagerProp,
    itUsers = []
}: ChatTabProps) {
    const router = useRouter();
    const isManager = Boolean(user?.isManager || user?.role === 'ADMIN' || isManagerProp);
    const [targetAssigneeId, setTargetAssigneeId] = useState<string | null>(null);
    const [chatText, setChatText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const recognitionRef = useRef<any>(null);
    const [chatCategory, setChatCategory] = useState<string>(targetDepartment === 'CNTT' ? 'SOFTWARE' : 'HARDWARE');
    const [staffSearchValue, setStaffSearchValue] = useState('');
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const [isSearchListening, setIsSearchListening] = useState(false);
    const [selfAssign, setSelfAssign] = useState(false);
    const isITStaff = user?.role === targetDepartment || user?.role === 'ADMIN';
    const searchRecognitionRef = useRef<any>(null);
    const lastPasteTimeRef = useRef<number>(0);

    const { baCode, baInfo, hasPaymentRequest, isChecking, isFound } = useCheckBa(chatText, { isChatText: true });

    // Normalize vietnamese string for better search
    const normalizeString = (str: string) => {
        return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .toLowerCase();
    };

    // Get initials (e.g. "Lê Thị Phượng" -> "ltp")
    const getInitials = (str: string) => {
        const normalized = normalizeString(str);
        return normalized.replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('');
    };

    const handleSearchVoiceInput = () => {
        if (isSearchListening && searchRecognitionRef.current) {
            searchRecognitionRef.current.stop();
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            message.warning("Trình duyệt không hỗ trợ nhận diện giọng nói!");
            return;
        }

        const recognition = new SpeechRecognition();
        searchRecognitionRef.current = recognition;
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        
        recognition.onstart = () => setIsSearchListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            const cleanText = transcript.replace(/\.$/, '');
            setStaffSearchValue(cleanText);
            setIsSelectOpen(true); // Open the dropdown to show filtered results
        };
        recognition.onerror = (event: any) => {
            console.warn('Speech recognition error:', event.error);
            setIsSearchListening(false);
            if (event.error === 'not-allowed') {
                message.error("Vui lòng cấp quyền sử dụng Micro cho trình duyệt!");
            } else if (event.error === 'network') {
                message.error("Trình duyệt chặn dịch vụ giọng nói. Vui lòng dùng Google Chrome!");
            }
        };
        recognition.onend = () => setIsSearchListening(false);
        
        try {
            recognition.start();
        } catch (error) {
            setIsSearchListening(false);
        }
    };

    const handleVoiceInput = () => {
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            message.warning("Trình duyệt không hỗ trợ nhận diện giọng nói!");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setChatText(prev => prev ? prev + ' ' + transcript : transcript);
        };
        recognition.onerror = (event: any) => {
            console.warn('Speech recognition error:', event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                message.error("Vui lòng cấp quyền sử dụng Micro cho trình duyệt!");
            } else if (event.error === 'network') {
                message.error("Trình duyệt (hoặc mạng bệnh viện) chặn dịch vụ giọng nói. Vui lòng dùng Google Chrome hoặc nhập tay!");
            } else if (event.error !== 'no-speech') {
                message.error("Lỗi nhận diện giọng nói: " + event.error);
            }
        };
        recognition.onend = () => setIsListening(false);
        
        try {
            recognition.start();
        } catch (error) {
            console.error("Error starting speech recognition", error);
            setIsListening(false);
        }
    };

    // Tách danh sách các mục từ chatText dựa theo dấu phẩy
    const getSelectedItems = (text: string): string[] => {
        if (!text || !text.trim()) return [];
        return text
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    };

    const isItemSelected = (reply: string): boolean => {
        const target = reply.trim();
        if (!target) return false;
        const items = getSelectedItems(chatText);
        return items.some(item => item.toLowerCase() === target.toLowerCase());
    };

    const handleToggleQuickReply = (reply: string) => {
        const target = reply.trim();
        if (!target) return;

        let items = getSelectedItems(chatText);
        const existingIndex = items.findIndex(item => item.toLowerCase() === target.toLowerCase());

        if (existingIndex >= 0) {
            // Đã chọn -> Bỏ chọn
            items.splice(existingIndex, 1);
        } else {
            // Chưa chọn -> Thêm vào danh sách
            items.push(target);
        }

        setChatText(items.join(', '));
    };

    const currentRepliesList = (chatCategory === 'SOFTWARE' ? softwareErrors : hardwareErrors)
        ?.map((item: any) => typeof item === 'string' ? item : item?.name)
        ?.filter((reply: any): reply is string => typeof reply === 'string' && reply.trim().length > 0) || [];

    const handleClearSelectedReplies = () => {
        const currentSuggestions = currentRepliesList.map((r: string) => r.trim().toLowerCase());
        const items = getSelectedItems(chatText);
        const remaining = items.filter(item => !currentSuggestions.includes(item.toLowerCase()));
        setChatText(remaining.join(', '));
    };

    const selectedRepliesCount = currentRepliesList.filter((reply: string) => isItemSelected(reply)).length;

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

    const handleCreateFromChat = async () => {
        if (!chatText.trim()) return message.warning("Vui lòng nhập mô tả sự cố!");
        
        let staffId = savedStaffId;
        if (!staffId && departmentStaff.length > 0) {
            staffId = departmentStaff[0].id;
            setSavedStaffId(staffId);
            localStorage.setItem('last_it_request_staff_id', staffId as string);
        }
        
        if (!staffId) return message.warning("Không xác định được người báo, vui lòng kiểm tra lại thông tin!");
        
        setChatLoading(true);

        let category = chatCategory;

        // Extract patientCode (Hỗ trợ cả mã có tiền tố BA hoặc dãy 6-15 chữ số)
        const patientMatch = chatText.match(/\b(BA\d+|\d{6,15})\b/i);
        const ma_ba = patientMatch ? patientMatch[0].toUpperCase() : null;

        const staff = departmentStaff.find(s => s.id === staffId);
        
        const dynamicObj: any = {
            'Ghi chú': 'Tạo tự động từ Chat',
            'SĐT': staff?.so_dien_thoai || '',
            'Người báo': staff?.ho_ten || ''
        };

        try {
            // Chỉ upload tệp lên máy chủ khi người dùng nhấn Gửi yêu cầu
            let uploadedUrls: string[] = [];
            if (uploadPendingFiles) {
                uploadedUrls = await uploadPendingFiles();
            } else {
                uploadedUrls = fileList.map((f: any) => f.url || f.response?.url).filter(Boolean);
            }

            if (uploadedUrls.length > 0) {
                dynamicObj['Hình ảnh đính kèm'] = uploadedUrls;
                dynamicObj['Tệp đính kèm'] = uploadedUrls;
            }

            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ma_ba: ma_ba,
                    category: category,
                    ten_loi: chatText,
                    ma_khoa: isAdmin ? (staff?.ma_khoa || user?.ma_khoa || departments[0]?.ma_khoa) : 'KHOA_HIENTAI', 
                    assigneeId: (isITStaff && selfAssign) ? user?.id : (isManager ? targetAssigneeId : null),
                    selfAssign: Boolean(isITStaff && selfAssign),
                    dynamicFields: dynamicObj,
                    nguoi_bao_id: staffId,
                    sdt: staff?.so_dien_thoai || '',
                    targetDepartment
                })
            });

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                if (clearFiles) clearFiles();
                const redirectPath = targetDepartment === 'VTYT' 
                    ? '/error-management/vtyt-requests' 
                    : (targetDepartment === 'HCQT' ? '/error-management/hcqt-requests' : '/error-management/it-requests');

                if (data.warningMessage) {
                    Modal.warning({
                        title: 'Đã gửi yêu cầu - Lưu ý tiếp nhận',
                        content: (
                            <div className="py-2">
                                <p className="text-amber-800 font-medium whitespace-pre-line leading-relaxed">{data.warningMessage}</p>
                            </div>
                        ),
                        okText: 'Đã hiểu và hoàn tất',
                        onOk: () => {
                            router.push(redirectPath);
                        }
                    });
                } else {
                    message.success('Gửi yêu cầu thành công!');
                    router.push(redirectPath);
                }
            } else {
                const err = await res.json();
                message.error(err.error || 'Gửi yêu cầu thất bại');
            }
        } catch (error: any) {
            console.error('Error submitting chat request:', error);
            message.error(error.message || 'Lỗi kết nối');
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-2.5 sm:p-6 shadow-inner flex flex-col min-h-[400px]">
            {/* Thanh thông tin người báo trong Chat Tab */}
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-2.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 shadow-sm mb-3 sm:mb-4 gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full flex-1 min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap shrink-0">
                        👤 Người báo:
                    </span>
                    {user?.staffId && !isAdmin && user?.role !== 'KHOA' ? (
                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-xs sm:text-sm truncate">
                            {departmentStaff.find((s: any) => s.id === user.staffId)?.ho_ten || 'Tài khoản cá nhân'}
                        </span>
                    ) : (
                        <div className="flex items-center gap-1 border border-slate-200 rounded-lg bg-slate-50 px-2 py-0.5 w-full sm:min-w-[260px] sm:max-w-[480px]">
                            <Select
                                size="small"
                                allowClear
                                open={isSelectOpen}
                                onOpenChange={(open) => setIsSelectOpen(open)}
                                value={departmentStaff.some((s: any) => s.id === savedStaffId) ? savedStaffId : undefined}
                                onChange={(val) => {
                                    setSavedStaffId(val);
                                    if (val) {
                                        localStorage.setItem('last_it_request_staff_id', val);
                                    } else {
                                        localStorage.removeItem('last_it_request_staff_id');
                                    }
                                    form.setFieldsValue({ nguoi_bao_id: val });
                                    setStaffSearchValue('');
                                    setIsSelectOpen(false);
                                }}
                                searchValue={staffSearchValue}
                                onSearch={setStaffSearchValue}
                                onBlur={() => {
                                    setStaffSearchValue('');
                                    setIsSelectOpen(false);
                                }}
                                className="w-full flex-1 min-w-0"
                                popupMatchSelectWidth={false}
                                placeholder={isAdmin ? "Tìm tên, khoa phòng, hoặc SĐT người gọi..." : "Chọn tên nhân viên"}
                                variant="borderless"
                                options={departmentStaff.map((s: any) => {
                                    const cv = s.chuc_danh || s.chuc_vu || '';
                                    const dept = s.department?.ten_khoa || s.ma_khoa || '';
                                    const phone = s.so_dien_thoai ? ` (${s.so_dien_thoai})` : '';
                                    const label = isAdmin 
                                        ? `${s.ho_ten}${cv ? ` (${cv})` : ''} - ${dept}${phone}` 
                                        : `${s.ho_ten}${cv ? ` (${cv})` : ''}${phone}`;
                                    return {
                                        value: s.id,
                                        label,
                                        searchtext: `${s.ho_ten} ${dept} ${s.so_dien_thoai || ''} ${cv}`
                                    };
                                })}
                                showSearch
                                filterOption={(input, option) => {
                                    if (!input) return true;
                                    const searchInput = normalizeString(input);
                                    const rawLabel = option?.label as string ?? '';
                                    const optionLabel = normalizeString(rawLabel);
                                    const searchText = normalizeString((option as any)?.searchtext || rawLabel);
                                    const initials = getInitials(rawLabel);
                                    return optionLabel.includes(searchInput) || searchText.includes(searchInput) || initials.includes(searchInput);
                                }}
                            />
                            <Tooltip title="Tìm bằng giọng nói">
                                <AudioOutlined 
                                    className={`cursor-pointer text-base px-1 shrink-0 transition-colors ${isSearchListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-500'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSearchVoiceInput();
                                    }}
                                />
                            </Tooltip>
                        </div>
                    )}
                </div>
                {isITStaff && (
                    <div className="flex items-center justify-between sm:justify-start gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-3 py-1.5 rounded-lg text-blue-900 shadow-2xs shrink-0 self-stretch md:self-auto">
                        <span className="text-xs font-bold text-blue-800">⚡ Tôi trực tiếp xử lý</span>
                        <Switch 
                            size="small" 
                            checked={selfAssign} 
                            onChange={setSelfAssign} 
                        />
                    </div>
                )}

                {isManager && !isITStaff && (
                    <div className="flex items-center gap-1.5 border border-purple-200 bg-purple-50/70 px-2.5 py-1 rounded-lg text-xs shrink-0 w-full sm:w-auto">
                        <span className="font-semibold text-purple-900 whitespace-nowrap">👑 Gửi đến:</span>
                        <Select
                            size="small"
                            allowClear
                            placeholder="Tự động phân công kỹ thuật"
                            value={targetAssigneeId || undefined}
                            onChange={(val) => setTargetAssigneeId(val || null)}
                            className="w-full sm:min-w-[210px]"
                            popupMatchSelectWidth={false}
                        >
                            {itUsers.filter((u: any) => u.isLeader).length > 0 && (
                                <Select.OptGroup label="👑 Lãnh đạo phòng CNTT (Chỉ đạo trực tiếp)">
                                    {itUsers.filter((u: any) => u.isLeader).map((u: any) => (
                                        <Select.Option key={u.id} value={u.id}>
                                            ⭐ {u.name || u.username} ({u.chuc_vu || 'Lãnh đạo'})
                                        </Select.Option>
                                    ))}
                                </Select.OptGroup>
                            )}
                            <Select.OptGroup label="🛠️ Nhân viên Kỹ thuật CNTT">
                                {itUsers.filter((u: any) => !u.isLeader).map((u: any) => (
                                    <Select.Option key={u.id} value={u.id}>
                                        {u.name || u.username}
                                    </Select.Option>
                                ))}
                            </Select.OptGroup>
                        </Select>
                    </div>
                )}
            </div>

            {/* Category Selection for Chat Tab */}
            {targetDepartment === 'CNTT' ? (
                <Radio.Group 
                    value={chatCategory} 
                    onChange={(e) => setChatCategory(e.target.value)}
                    className="w-full mb-3 sm:mb-4 flex rounded-lg p-1 bg-white border border-slate-200 shadow-sm" 
                    optionType="button" 
                    buttonStyle="solid"
                >
                    <Radio.Button value="SOFTWARE" className={`flex-1 text-center border-none shadow-none font-semibold text-xs sm:text-sm h-9 flex items-center justify-center py-1 ${chatCategory === 'SOFTWARE' ? 'bg-blue-50 text-blue-600' : 'bg-transparent text-slate-600'}`}>
                        Bệnh án
                    </Radio.Button>
                    <Radio.Button value="HARDWARE" className={`flex-1 text-center border-none shadow-none font-semibold text-xs sm:text-sm h-9 flex items-center justify-center py-1 ${chatCategory === 'HARDWARE' ? 'bg-blue-50 text-blue-600' : 'bg-transparent text-slate-600'}`}>
                        Thiết bị / Sửa chữa
                    </Radio.Button>
                </Radio.Group>
            ) : null}

            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                        <BugOutlined />
                    </div>
                    <div className="bg-white p-3 sm:p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 text-[14px] sm:text-[15px] text-slate-700 max-w-[85%]">
                        Chào bạn! Bạn đang gặp sự cố gì? 
                        <br/>
                        <span className="text-slate-500 text-[13px] mt-1 block">
                            Hãy chọn nhanh gợi ý bên dưới <em>(có thể chọn nhiều việc)</em>, đọc vào Micro, hoặc gõ chữ nhé.
                        </span>
                    </div>
                </div>
            </div>

            {/* Header gợi ý & nút Bỏ chọn nếu có */}
            <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-xs font-semibold text-slate-600">Gợi ý sự cố phổ biến:</span>
                {selectedRepliesCount > 0 && (
                    <button 
                        type="button"
                        onClick={handleClearSelectedReplies}
                        className="text-xs text-blue-600 hover:text-red-600 font-medium transition-colors cursor-pointer"
                    >
                        Bỏ chọn ({selectedRepliesCount})
                    </button>
                )}
            </div>

            {/* Quick Replies */}
            <div className="flex flex-wrap gap-2 mb-2">
                {currentRepliesList.map((reply: string) => {
                    const selected = isItemSelected(reply);
                    return (
                        <div 
                            key={reply} 
                            onClick={() => handleToggleQuickReply(reply)}
                            className={`max-w-full whitespace-normal leading-relaxed text-center px-3.5 py-1.5 rounded-2xl text-[13px] font-medium border cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 select-none
                                ${selected 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-semibold' 
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                            `}
                        >
                            {selected && <CheckOutlined className="text-xs shrink-0" />}
                            <span>{reply}</span>
                        </div>
                    );
                })}
            </div>

            <BaPaymentStatusAlert
                baCode={baCode}
                baInfo={baInfo}
                hasPaymentRequest={hasPaymentRequest}
                isChecking={isChecking}
                isFound={isFound}
                className="mb-2"
            />

            <div 
                onPaste={handlePaste}
                className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
            >
                {fileList.length > 0 && (
                    <div className="px-3 pt-2 pb-1">
                        <Upload {...uploadProps} />
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <div className="flex gap-1 sm:gap-2 px-1 pb-1">
                        <Dropdown 
                            trigger={['click']}
                            menu={{
                                items: [
                                    {
                                        key: '1',
                                        label: (
                                            <label className="flex items-center gap-3 py-1 cursor-pointer w-full text-slate-700">
                                                <PictureOutlined className="text-lg text-blue-500" />
                                                <span className="font-medium text-[14px]">Chọn ảnh từ thư viện</span>
                                                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                                            </label>
                                        )
                                    },
                                    {
                                        key: '2',
                                        label: (
                                            <label className="flex items-center gap-3 py-1 cursor-pointer w-full text-slate-700">
                                                <CameraOutlined className="text-lg text-green-500" />
                                                <span className="font-medium text-[14px]">Chụp ảnh (Điện thoại)</span>
                                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                                            </label>
                                        )
                                    },
                                    {
                                        key: '3',
                                        label: (
                                            <label className="flex items-center gap-3 py-1 cursor-pointer w-full text-slate-700 border-t border-slate-100 pt-1.5 mt-0.5">
                                                <PaperClipOutlined className="text-lg text-purple-600" />
                                                <span className="font-medium text-[14px]">Đính kèm tệp / Tài liệu (PDF, Word, Excel, Zip...)</span>
                                                <input type="file" multiple className="hidden" onChange={handleFileChange} />
                                            </label>
                                        )
                                    }
                                ]
                            }}
                        >
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors" title="Đính kèm ảnh hoặc tài liệu">
                                <PaperClipOutlined className="text-xl" />
                            </div>
                        </Dropdown>
                    </div>

                    <Input.TextArea 
                        value={chatText}
                        onChange={e => setChatText(e.target.value)}
                        onPaste={handlePaste}
                        placeholder="Mô tả chi tiết sự cố của bạn ở đây... (Enter để gửi, Ctrl+Enter để xuống dòng)" 
                        autoSize={{ minRows: 2, maxRows: 5 }}
                        className="flex-1 !border-none !shadow-none !ring-0 !bg-transparent text-[16px] py-3 px-2 leading-relaxed"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (e.ctrlKey || e.metaKey) {
                                    e.preventDefault();
                                    const target = e.currentTarget;
                                    const start = target.selectionStart;
                                    const end = target.selectionEnd;
                                    const val = target.value;
                                    const updated = val.substring(0, start) + '\n' + val.substring(end);
                                    setChatText(updated);
                                    setTimeout(() => {
                                        target.selectionStart = target.selectionEnd = start + 1;
                                    }, 0);
                                } else if (!e.shiftKey) {
                                    e.preventDefault();
                                    handleCreateFromChat();
                                }
                            }
                        }}
                    />

                    <div className="flex gap-2 p-1">
                        <Tooltip title="Nhập bằng giọng nói">
                            <Button 
                                type={isListening ? 'primary' : 'default'} 
                                danger={isListening}
                                shape="circle" 
                                size="large" 
                                icon={<AudioOutlined className={isListening ? 'animate-pulse' : ''} />} 
                                onClick={handleVoiceInput}
                                className="border-none bg-slate-100 hover:bg-slate-200 shadow-none"
                            />
                        </Tooltip>
                        <Tooltip title="Gửi yêu cầu (Enter)">
                            <Button 
                                type="primary" 
                                shape="circle" 
                                size="large" 
                                icon={<SendOutlined />} 
                                onClick={handleCreateFromChat}
                                loading={chatLoading || uploadingFiles}
                                disabled={chatLoading || uploadingFiles}
                                className="bg-blue-600"
                            />
                        </Tooltip>
                    </div>
                </div>

                {/* Hiển thị các liên kết phát hiện được trong nội dung để click mở ngay */}
                <DetectedLinkBar text={chatText} className="mt-2.5" />
            </div>
            
            {!savedStaffId && departmentStaff.length > 0 && (
                 <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800 flex items-center justify-between">
                     <span>Lần đầu sử dụng, vui lòng chọn tên của bạn (tại tab Điền Form) để hệ thống ghi nhớ nhé!</span>
                     <Button size="small" onClick={() => setActiveTab('form')}>Sang Tab Form</Button>
                 </div>
            )}
        </div>
    );
}
