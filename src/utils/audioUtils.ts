export const playNotificationSound = () => {
    try {
        if (typeof window === 'undefined') return;

        // Check if muted
        const isMuted = localStorage.getItem('it_notification_muted') === 'true';
        if (isMuted) return;

        // Check for custom audio
        const customAudio = localStorage.getItem('it_notification_audio');
        if (customAudio) {
            const audio = new Audio(customAudio);
            audio.play().catch(e => {
                console.error('Lỗi khi phát âm thanh tùy chỉnh', e);
                playFallbackSound(); // Play fallback if custom fails
            });
            return;
        }

        playFallbackSound();
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

const playFallbackSound = () => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // Nốt C5
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // Nốt E5
        
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        console.error('Fallback audio failed', e);
    }
};
