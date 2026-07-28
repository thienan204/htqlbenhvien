export const addWorkingDays = (startDate: Date, days: number): Date => {
    const result = new Date(startDate);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        // 0 is Sunday, 6 is Saturday
        if (result.getDay() !== 0 && result.getDay() !== 6) {
            added++;
        }
    }
    return result;
}

export const calculateRemainingTime = (deadline: Date): { text: string, isExpired: boolean } => {
    const now = new Date();
    // Đưa về 00:00:00 để chỉ so sánh theo ngày
    const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffMs = deadlineDate.getTime() - nowDate.getTime();
    if (diffMs < 0) {
        return { text: 'Đã quá hạn', isExpired: true };
    }
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
        return { text: 'Hết hạn hôm nay', isExpired: false };
    }
    return { 
        text: `Còn ${diffDays} ngày`, 
        isExpired: false 
    };
}
