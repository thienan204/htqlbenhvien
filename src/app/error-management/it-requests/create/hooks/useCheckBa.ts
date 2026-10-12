import { useState, useEffect, useRef } from 'react';
import { getBasePath } from '@/utils/config';

export interface BaRecord {
    id: string;
    maLienKet: string;
    maBN: string | null;
    hoTen: string | null;
    ngayRa: string | null;
    ngayDeNghiTT: string | null;
    trangThaiTT: string | null;
    trangThaiHS: string | null;
}

export interface CheckBaResult {
    baCode: string | null;
    baInfo: BaRecord | null;
    hasPaymentRequest: boolean;
    isChecking: boolean;
    isFound: boolean;
    triggerCheck: (code: string) => Promise<void>;
}

// Client-side Memory Cache lưu trong session (0ms khi gõ lại)
const clientBaCache = new Map<string, { exists: boolean; data?: BaRecord; hasPaymentRequest?: boolean }>();

export function useCheckBa(input: string | null | undefined, options?: { isChatText?: boolean; debounceMs?: number }): CheckBaResult {
    const isChat = options?.isChatText ?? false;
    const debounceMs = options?.debounceMs ?? 200;

    const [baCode, setBaCode] = useState<string | null>(null);
    const [baInfo, setBaInfo] = useState<BaRecord | null>(null);
    const [hasPaymentRequest, setHasPaymentRequest] = useState<boolean>(false);
    const [isChecking, setIsChecking] = useState<boolean>(false);
    const [isFound, setIsFound] = useState<boolean>(false);

    const timeoutRef = useRef<any>(null);
    const currentCodeRef = useRef<string | null>(null);

    const executeCheck = async (codeToCheck: string) => {
        const cleanCode = codeToCheck.trim().toUpperCase();
        if (!cleanCode || cleanCode.length < 3) {
            setBaInfo(null);
            setHasPaymentRequest(false);
            setIsFound(false);
            setIsChecking(false);
            return;
        }

        // 1. Kiểm tra Client Cache
        if (clientBaCache.has(cleanCode)) {
            const cached = clientBaCache.get(cleanCode)!;
            if (cached.exists && cached.data) {
                setBaInfo(cached.data);
                setHasPaymentRequest(Boolean(cached.hasPaymentRequest));
                setIsFound(true);
            } else {
                setBaInfo(null);
                setHasPaymentRequest(false);
                setIsFound(false);
            }
            setIsChecking(false);
            return;
        }

        // 2. Gọi API tra cứu
        setIsChecking(true);
        try {
            const res = await fetch(`${getBasePath()}/api/ho-so-da-gui/check-ba?code=${encodeURIComponent(cleanCode)}`);
            if (res.ok) {
                const json = await res.json();
                clientBaCache.set(cleanCode, json);

                // Kiểm tra xem mã đang xử lý có phải mã mới nhất không
                if (currentCodeRef.current === cleanCode) {
                    if (json.exists && json.data) {
                        setBaInfo(json.data);
                        setHasPaymentRequest(Boolean(json.hasPaymentRequest));
                        setIsFound(true);
                    } else {
                        setBaInfo(null);
                        setHasPaymentRequest(false);
                        setIsFound(false);
                    }
                }
            } else {
                if (currentCodeRef.current === cleanCode) {
                    setBaInfo(null);
                    setHasPaymentRequest(false);
                    setIsFound(false);
                }
            }
        } catch (err) {
            console.error('Lỗi kiểm tra BA:', err);
            if (currentCodeRef.current === cleanCode) {
                setBaInfo(null);
                setHasPaymentRequest(false);
                setIsFound(false);
            }
        } finally {
            if (currentCodeRef.current === cleanCode) {
                setIsChecking(false);
            }
        }
    };

    useEffect(() => {
        const raw = (input || '').trim();
        let extracted: string | null = null;

        if (isChat) {
            // Nếu là chuỗi chat, trích xuất BA... hoặc dãy số 6-15 ký tự
            const match = raw.match(/\b(BA\d+|\d{6,15})\b/i);
            extracted = match ? match[0] : null;
        } else {
            // Nếu là ô nhập mã BA trực tiếp
            extracted = raw.length >= 3 ? raw : null;
        }

        setBaCode(extracted);
        currentCodeRef.current = extracted ? extracted.trim().toUpperCase() : null;

        if (!extracted) {
            setBaInfo(null);
            setHasPaymentRequest(false);
            setIsFound(false);
            setIsChecking(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }

        const cleanExtracted = extracted.trim().toUpperCase();

        // Nếu đã có trong Client Cache, cập nhật luôn không cần debounce
        if (clientBaCache.has(cleanExtracted)) {
            const cached = clientBaCache.get(cleanExtracted)!;
            if (cached.exists && cached.data) {
                setBaInfo(cached.data);
                setHasPaymentRequest(Boolean(cached.hasPaymentRequest));
                setIsFound(true);
            } else {
                setBaInfo(null);
                setHasPaymentRequest(false);
                setIsFound(false);
            }
            setIsChecking(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }

        // Debounce gọi API để gõ mượt mà
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            executeCheck(extracted!);
        }, debounceMs);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [input, isChat, debounceMs]);

    return {
        baCode,
        baInfo,
        hasPaymentRequest,
        isChecking,
        isFound,
        triggerCheck: executeCheck
    };
}
