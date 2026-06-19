export interface Ticket {
    id: string;
    ma_ba: string;
    ten_loi: string;
    ma_khoa: string;
    status: string;
    assigneeId: string | null;
    assigneeName: string;
    transferToId?: string | null;
    transferToName?: string | null;
    dynamicFields: any;
    it_note: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ITUser {
    id: string;
    username: string;
    name: string;
    isAvailable: boolean;
}
