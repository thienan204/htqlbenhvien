'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, Alert, message } from 'antd';
import {
    KeyOutlined,
    SafetyCertificateOutlined,
    UserOutlined,
    LockOutlined,
    ScanOutlined,
    InfoCircleOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { getBasePath } from '@/utils/config';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';

function LoginForm() {
    const [activeTab, setActiveTab] = useState<'password' | 'biometric'>('password');

    // Password login state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Biometric login state
    const [bioIdentifier, setBioIdentifier] = useState('');
    const [bioLoading, setBioLoading] = useState(false);
    const [bioError, setBioError] = useState('');
    const [bioSuccess, setBioSuccess] = useState(false);
    const [isWebAuthnSupported, setIsWebAuthnSupported] = useState(true);

    const router = useRouter();
    const searchParams = useSearchParams();
    const returnUrl = searchParams.get('returnUrl');
    const reason = searchParams.get('reason');

    useEffect(() => {
        setIsWebAuthnSupported(browserSupportsWebAuthn());
    }, []);

    const handleRedirect = () => {
        if (returnUrl) {
            const decoded = decodeURIComponent(returnUrl);
            const basePath = getBasePath();
            let target = decoded;
            if (!target.startsWith(basePath)) {
                if (!target.startsWith('/')) target = '/' + target;
                target = basePath + target;
            }
            window.location.href = target;
            return;
        }
        window.location.href = getBasePath() + '/';
    };

    // 1. Đăng nhập bằng Mật khẩu
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                handleRedirect();
                return;
            } else {
                setError(data.error || 'Đăng nhập thất bại');
                setLoading(false);
            }
        } catch (err: any) {
            console.error("Login fetch error:", err);
            if (err?.message?.includes('Server Action') || err?.message?.includes('not found on the server')) {
                window.location.reload();
                return;
            }
            setError(err.message || 'Có lỗi kết nối máy chủ, vui lòng thử lại');
            setLoading(false);
        }
    };

    // 2. Đăng nhập bằng Sinh trắc học (WebAuthn / Passkey)
    const handleBiometricLogin = async () => {
        setBioError('');
        setBioLoading(true);

        try {
            // Bước 1: Yêu cầu challenge từ máy chủ
            const challengeRes = await fetch('/api/auth/passkey/login-challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: bioIdentifier.trim() || undefined
                })
            });

            const challengeData = await challengeRes.json();
            if (!challengeRes.ok) {
                throw new Error(challengeData.error || 'Không thể tạo thử thách xác thực sinh trắc học');
            }

            // Bước 2: Kích hoạt WebAuthn native trên trình duyệt (FaceID / TouchID / Windows Hello)
            let authResponse;
            try {
                authResponse = await startAuthentication({ optionsJSON: challengeData });
            } catch (authErr: any) {
                if (authErr.name === 'NotAllowedError') {
                    setBioError('Thao tác quét vân tay / FaceID đã bị hủy.');
                    setBioLoading(false);
                    return;
                }
                throw authErr;
            }

            // Bước 3: Gửi kết quả chữ ký số lên server xác thực
            const verifyRes = await fetch('/api/auth/passkey/login-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: authResponse })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
                throw new Error(verifyData.error || 'Xác thực sinh trắc học không thành công');
            }

            setBioSuccess(true);
            message.success('Xác thực vân tay / FaceID thành công!');
            setTimeout(() => {
                handleRedirect();
            }, 500);

        } catch (err: any) {
            console.error('Biometric login error:', err);
            setBioError(err.message || 'Thiết bị không nhận diện được vân tay / FaceID hoặc chưa được đăng ký.');
        } finally {
            setBioLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden py-10">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-200/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/20 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md p-8 bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 relative z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-1.5">Đăng Nhập</h1>
                    <p className="text-slate-500 text-sm font-medium">Hệ thống Quản lý Bệnh viện Đa khoa Lạng Sơn</p>
                </div>

                {reason === 'timeout' && (
                    <Alert
                        title="Phiên làm việc hết hạn"
                        description="Hệ thống đã tự động khóa sau 30 phút không hoạt động để bảo vệ an toàn thông tin y tế."
                        type="warning"
                        showIcon
                        className="mb-5 rounded-2xl"
                    />
                )}

                <Tabs
                    activeKey={activeTab}
                    onChange={(k) => {
                        setActiveTab(k as any);
                        setError('');
                        setBioError('');
                    }}
                    type="card"
                    className="mb-4"
                    items={[
                        {
                            key: 'password',
                            label: (
                                <span className="flex items-center gap-1.5 font-bold text-xs">
                                    <KeyOutlined /> Mật khẩu
                                </span>
                            ),
                            children: (
                                <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
                                    {error && (
                                        <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold flex items-start gap-2 animate-in slide-in-from-top-2">
                                            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <div>{error}</div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">
                                            Tài khoản / Mã NV / CCCD
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                                                placeholder="Nhập tài khoản, mã NV hoặc CCCD..."
                                                required
                                            />
                                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                                <UserOutlined className="text-base" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">
                                            Mật khẩu
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                                                placeholder="••••••••"
                                                required
                                            />
                                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                                <LockOutlined className="text-base" />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3.5 mt-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-lg shadow-cyan-200 hover:shadow-cyan-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group cursor-pointer"
                                    >
                                        {loading && (
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        )}
                                        {loading ? 'Đang xác thực...' : 'Đăng nhập Mật khẩu'}
                                    </button>
                                </form>
                            )
                        },
                        {
                            key: 'biometric',
                            label: (
                                <span className="flex items-center gap-1.5 font-bold text-xs text-cyan-700">
                                    <SafetyCertificateOutlined /> Sinh trắc học
                                </span>
                            ),
                            children: (
                                <div className="space-y-4 pt-2">
                                    {bioError && (
                                        <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold flex items-start gap-2 animate-in slide-in-from-top-2">
                                            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <div>{bioError}</div>
                                        </div>
                                    )}

                                    {bioSuccess && (
                                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
                                            <CheckCircleOutlined className="text-base text-emerald-600" />
                                            <div>Xác thực sinh trắc học thành công! Đang chuyển hướng...</div>
                                        </div>
                                    )}

                                    <div className="p-3.5 bg-cyan-50/80 border border-cyan-100 rounded-xl text-cyan-900 text-xs flex gap-2 items-start">
                                        <InfoCircleOutlined className="text-cyan-600 text-sm mt-0.5 shrink-0" />
                                        <div>
                                            Đăng nhập 1-chạm bằng <strong>Vân tay, FaceID hoặc Windows Hello</strong> đã liên kết với thiết bị của bạn.
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">
                                            Tài khoản / CCCD / Mã NV (Tùy chọn)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={bioIdentifier}
                                                onChange={(e) => setBioIdentifier(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                                                placeholder="Để trống nếu đã lưu Passkey trên máy..."
                                            />
                                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                                <UserOutlined className="text-base" />
                                            </div>
                                        </div>
                                    </div>

                                    {!isWebAuthnSupported ? (
                                        <Alert
                                            title="Thiết bị không hỗ trợ"
                                            description="Trình duyệt hoặc thiết bị này không hỗ trợ xác thực sinh trắc học WebAuthn. Vui lòng dùng mật khẩu."
                                            type="warning"
                                            showIcon
                                            className="rounded-xl"
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleBiometricLogin}
                                            disabled={bioLoading}
                                            className="w-full py-4 mt-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-lg shadow-cyan-200 hover:shadow-cyan-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer"
                                        >
                                            {bioLoading ? (
                                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <ScanOutlined className="text-lg" />
                                            )}
                                            {bioLoading ? 'Đang chờ chạm Vân tay / FaceID...' : 'Chạm Vân tay / Quét FaceID'}
                                        </button>
                                    )}

                                    <div className="text-center pt-2">
                                        <span className="text-[11px] text-slate-400">
                                            Chưa liên kết vân tay? Hãy đăng nhập bằng mật khẩu, sau đó bấm vào góc trên bên phải để kích hoạt.
                                        </span>
                                    </div>
                                </div>
                            )
                        }
                    ]}
                />
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-medium text-slate-500">Đang tải...</div>}>
            <LoginForm />
        </Suspense>
    );
}
