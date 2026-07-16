import { addClient, removeClient } from '@/lib/notificationService';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let controllerRef: ReadableStreamDefaultController | null = null;
  const maKhoa = req.nextUrl.searchParams.get('ma_khoa') || null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      addClient(controller, maKhoa);
      
      const connectMessage = `data: ${JSON.stringify({ eventCode: 'CONNECTED', message: 'Connected to notification stream' })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectMessage));

      const interval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch (e) {
          clearInterval(interval);
        }
      }, 30000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        if (controllerRef) removeClient(controllerRef);
      });
    },
    cancel() {
      if (controllerRef) removeClient(controllerRef);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    },
  });
}
