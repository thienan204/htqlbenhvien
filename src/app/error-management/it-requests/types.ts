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
    createdAt: string;
    updatedAt: string;
}

export interface ITUser {
    id: string;
    username: string;
    name: string;
    isAvailable: boolean;
}
