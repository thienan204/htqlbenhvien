export interface Ticket {
    id: string;
    ma_ba: string;
    category: string;
    ten_loi: string;
    ma_khoa: string;
    status: string;
    assigneeId: string | null;
    assigneeName: string;
    assigneePhone?: string | null;
    transferToId?: string | null;
    transferToName?: string | null;
    dynamicFields: any;
    it_note: string | null;
    messageCount?: number;
    hasXml?: boolean;
    ten_khoa?: string;
    nguoi_bao?: string;
    createdAt: string;
    updatedAt: string;
    startedAt?: string | null;
    resolvedAt?: string | null;
    isFocusTask?: boolean;
    vendorId?: string | null;
    vendorName?: string | null;
    vendorTicketCode?: string | null;
    vendorSentAt?: string | null;
    vendorExpectedReturnAt?: string | null;
    it_images?: string[];
}

export interface VendorItem {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    bhyt_code?: string | null;
    isActive: boolean;
}

export interface ITUser {
    id: string;
    username: string;
    name: string;
    role?: string | null;
    isAvailable: boolean;
    autoAssignDisabled?: boolean;
    focusReason?: string | null;
}
