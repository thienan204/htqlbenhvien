export interface SoundConfig {
    mode?: 'DEPARTMENT' | 'CUSTOM';
    type: 'DEFAULT' | 'UPLOAD' | 'DIRECT_URL' | 'YOUTUBE';
    url?: string;
    duration?: number;
    name?: string;
}

let currentAudioInstance: HTMLAudioElement | null = null;
let ytPlayer: any = null;
let ytStopTimeout: any = null;
let ytReadyPromise: Promise<any> | null = null;

// Hàm trích xuất YouTube ID từ mọi dạng link YouTube
export function extractYouTubeId(url: string): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
}

// Khởi tạo YouTube Iframe API ngầm
function initYouTubeAPI(): Promise<any> {
    if (typeof window === 'undefined') return Promise.reject('No window');
    if (ytReadyPromise) return ytReadyPromise;

    ytReadyPromise = new Promise((resolve, reject) => {
        try {
            // Tạo hidden container nếu chưa có
            let container = document.getElementById('yt-notification-player-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'yt-notification-player-container';
                container.style.position = 'fixed';
                container.style.width = '1px';
                container.style.height = '1px';
                container.style.left = '-9999px';
                container.style.bottom = '0';
                container.style.opacity = '0.001';
                container.style.pointerEvents = 'none';
                container.style.zIndex = '-9999';
                
                const playerDiv = document.createElement('div');
                playerDiv.id = 'yt-notification-iframe';
                container.appendChild(playerDiv);
                document.body.appendChild(container);
            }

            const onApiReady = () => {
                if ((window as any).YT && (window as any).YT.Player) {
                    try {
                        ytPlayer = new (window as any).YT.Player('yt-notification-iframe', {
                            height: '1',
                            width: '1',
                            playerVars: {
                                autoplay: 0,
                                controls: 0,
                                disablekb: 1,
                                fs: 0,
                                modestbranding: 1,
                                rel: 0,
                            },
                            events: {
                                onReady: () => resolve(ytPlayer),
                                onError: () => {
                                    console.warn('YouTube Player error, falling back to default sound');
                                    resolve(null);
                                }
                            }
                        });
                    } catch (e) {
                        console.error('Error creating YT player:', e);
                        resolve(null);
                    }
                }
            };

            if ((window as any).YT && (window as any).YT.Player) {
                onApiReady();
            } else {
                const existingScript = document.getElementById('youtube-iframe-api-script');
                if (!existingScript) {
                    const tag = document.createElement('script');
                    tag.id = 'youtube-iframe-api-script';
                    tag.src = 'https://www.youtube.com/iframe_api';
                    document.body.appendChild(tag);
                }
                const prevCallback = (window as any).onYouTubeIframeAPIReady;
                (window as any).onYouTubeIframeAPIReady = () => {
                    if (prevCallback) prevCallback();
                    onApiReady();
                };
                // Fallback timeout sau 4s nếu YouTube bị chặn
                setTimeout(() => resolve(ytPlayer), 4000);
            }
        } catch (err) {
            reject(err);
        }
    });

    return ytReadyPromise;
}

// Dừng toàn bộ âm thanh đang phát
export function stopAllNotificationSounds() {
    if (currentAudioInstance) {
        try {
            currentAudioInstance.pause();
            currentAudioInstance.currentTime = 0;
        } catch (e) {}
        currentAudioInstance = null;
    }

    if (ytStopTimeout) {
        clearTimeout(ytStopTimeout);
        ytStopTimeout = null;
    }

    if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
        try {
            ytPlayer.stopVideo();
        } catch (e) {}
    }
}

// Phát âm thanh theo đối tượng cấu hình
export async function playSoundByConfig(config: SoundConfig): Promise<void> {
    stopAllNotificationSounds();

    if (!config || config.type === 'DEFAULT') {
        playFallbackSound();
        return;
    }

    const duration = config.duration && config.duration > 0 ? config.duration : 7;

    if (config.type === 'YOUTUBE' && config.url) {
        const videoId = extractYouTubeId(config.url);
        if (!videoId) {
            console.warn('Invalid YouTube URL, fallback');
            playFallbackSound();
            return;
        }

        try {
            await initYouTubeAPI();
            if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
                ytPlayer.loadVideoById({
                    videoId,
                    startSeconds: 0
                });
                ytPlayer.setVolume(100);
                ytPlayer.playVideo();

                ytStopTimeout = setTimeout(() => {
                    try {
                        if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
                            ytPlayer.stopVideo();
                        }
                    } catch (e) {}
                }, duration * 1000);
                return;
            } else {
                playFallbackSound();
            }
        } catch (err) {
            console.error('Error playing YouTube audio:', err);
            playFallbackSound();
        }
        return;
    }

    if ((config.type === 'UPLOAD' || config.type === 'DIRECT_URL') && config.url) {
        try {
            const audio = new Audio(config.url);
            currentAudioInstance = audio;
            audio.play().catch(e => {
                console.error('Lỗi khi phát âm thanh audio file/url:', e);
                playFallbackSound();
            });

            if (duration > 0) {
                ytStopTimeout = setTimeout(() => {
                    stopAllNotificationSounds();
                }, duration * 1000);
            }
            return;
        } catch (e) {
            console.error('Lỗi khởi tạo Audio:', e);
            playFallbackSound();
            return;
        }
    }

    playFallbackSound();
}

// Hàm chính phát chuông khi có sự kiện (Hỗ trợ phân tầng: Cá nhân -> Phòng ban -> Legacy -> Mặc định)
export const playNotificationSound = (targetDepartment: string = 'CNTT', userId?: string) => {
    try {
        if (typeof window === 'undefined') return;

        // 1. Kiểm tra tắt chuông (Mute)
        const isUserMuted = userId ? localStorage.getItem(`user_${userId}_notification_muted`) === 'true' : false;
        const isDeptMuted = localStorage.getItem(`${targetDepartment}_notification_muted`) === 'true';
        if (isUserMuted || isDeptMuted) return;

        // 2. Kiểm tra chuông riêng của tài khoản cá nhân (nếu đã cấu hình chuông riêng và có URL)
        if (userId) {
            const userConfigStr = localStorage.getItem(`user_${userId}_notification_audio_config`);
            if (userConfigStr) {
                try {
                    const userConfig: SoundConfig = JSON.parse(userConfigStr);
                    if (userConfig.mode === 'CUSTOM' && userConfig.type !== 'DEFAULT' && userConfig.url) {
                        playSoundByConfig(userConfig);
                        return;
                    }
                } catch (e) {}
            }
        }

        // 3. Kiểm tra chuông chung của phòng ban (chỉ nhận nếu có cấu hình tùy chỉnh UPLOAD / DIRECT_URL / YOUTUBE)
        const deptConfigStr = localStorage.getItem(`${targetDepartment}_department_notification_sound`);
        if (deptConfigStr) {
            try {
                const deptConfig: SoundConfig = JSON.parse(deptConfigStr);
                if (deptConfig.type !== 'DEFAULT' && deptConfig.url) {
                    playSoundByConfig(deptConfig);
                    return;
                }
            } catch (e) {}
        }

        // 4. KIỂM TRA FILE CHUÔNG CŨ (LEGACY) MÀ NGƯỜI DÙNG ĐÃ TẢI LÊN TRƯỚC ĐÓ!
        // Giúp khôi phục âm thanh nguyên bản 100% như trước khi làm phương án phân tầng
        const legacyAudio = localStorage.getItem(`${targetDepartment}_notification_audio`);
        if (legacyAudio) {
            try {
                stopAllNotificationSounds();
                const audio = new Audio(legacyAudio);
                currentAudioInstance = audio;
                audio.play().catch(err => {
                    console.warn('Lỗi phát âm thanh legacy:', err);
                    playFallbackSound();
                });
                return;
            } catch (e) {
                console.error('Lỗi khi khởi tạo âm thanh legacy:', e);
            }
        }

        // 5. Chuông mặc định tiếng "Ting"
        playFallbackSound();
    } catch (e) {
        console.error('Audio play failed', e);
        playFallbackSound();
    }
};

// Tiếng "Ting" mặc định sử dụng Web Audio API (có resume để không bị trình duyệt chặn)
export const playFallbackSound = () => {
    try {
        if (typeof window === 'undefined') return;
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }

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
