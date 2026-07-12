import * as admin from 'firebase-admin';

// Khởi tạo Firebase Admin SDK
// Đảm bảo chỉ khởi tạo 1 lần
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Replace \n with actual newlines if it comes from env
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
        console.log('Firebase Admin Initialized successfully');
    } catch (error) {
        console.error('Firebase Admin Initialization error', error);
    }
}

export const messaging = admin.apps.length ? admin.messaging() : null;

export async function sendPushNotification(tokens: string[], title: string, body: string, data?: any) {
    if (!messaging || tokens.length === 0) return;
    
    try {
        const message: admin.messaging.MulticastMessage = {
            notification: {
                title,
                body,
            },
            data: data || {},
            tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(response.successCount + ' messages were sent successfully');
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
                }
            });
        }
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
}
