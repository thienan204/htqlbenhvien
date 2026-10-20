export interface TelegramSendOptions {
    message: string;
    chatId?: string;
    botToken?: string;
    replyMarkup?: any;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

/**
 * Gửi tin nhắn Telegram qua Bot API
 */
export async function sendTelegramMessage(
    message: string,
    chatId?: string,
    botToken?: string,
    replyMarkup?: any,
    parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<{ success: boolean; data?: any; error?: string }> {
    const targetBotToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!targetBotToken || !targetChatId) {
        return { success: false, error: 'Thiếu Bot Token hoặc Chat ID Telegram' };
    }

    try {
        const payload: any = {
            chat_id: targetChatId,
            text: message,
            parse_mode: parseMode
        };
        if (replyMarkup) {
            payload.reply_markup = replyMarkup;
        }

        const res = await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
            console.error('Lỗi Telegram API:', data);
            return { success: false, error: data.description || 'Lỗi gửi tin nhắn Telegram' };
        }

        return { success: true, data };
    } catch (err: any) {
        console.error('Lỗi ngoại lệ khi gửi Telegram:', err);
        return { success: false, error: err.message || 'Lỗi mạng khi gọi Telegram API' };
    }
}
