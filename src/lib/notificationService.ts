import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Keep track of connected clients: Controller -> maKhoa
const clients = new Map<ReadableStreamDefaultController, string | null>();

export function addClient(controller: ReadableStreamDefaultController, maKhoa: string | null = null) {
  clients.set(controller, maKhoa);
}

export function removeClient(controller: ReadableStreamDefaultController) {
  clients.delete(controller);
}

/**
 * Utility to replace {{key}} with values from context
 */
function renderTemplate(template: string | null | undefined, context: any = {}): string | null {
  if (!template) return null;
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (match, key) => {
    return context[key] !== undefined ? String(context[key]) : match;
  });
}

/**
 * Emits an event to connected clients.
 * @param eventCode The code of the event (e.g., 'IT_REQUEST_NEW')
 * @param payload The data to send
 * @param targetMaKhoa (Optional) If provided, only sends to clients with this maKhoa
 */
export async function emitEvent(eventCode: string, payload: any, targetMaKhoa?: string | null) {
  try {
    const setting = await prisma.notificationSetting.findUnique({
      where: { eventCode },
    });

    if (!setting || !setting.isEnabled) {
      console.log(`[NotificationService] Event ${eventCode} is disabled. Skipping emit.`);
      return;
    }

    // Apply templates if they exist, falling back to original payload
    const context = payload.context || {};
    const finalTitle = renderTemplate(setting.titleTemplate, context) || payload.title;
    const finalBody = renderTemplate(setting.messageTemplate, context) || payload.body;
    const finalUrl = renderTemplate(setting.linkUrl, context) || payload.url;

    // Clean up payload before sending to remove context if we don't need it on client
    const { context: _, ...restPayload } = payload;
    const sendPayload = {
      ...restPayload,
      title: finalTitle,
      body: finalBody,
      url: finalUrl,
    };

    const dataString = `data: ${JSON.stringify({ eventCode, ...sendPayload })}\n\n`;

    let emitCount = 0;
    clients.forEach((clientMaKhoa, client) => {
      // If targetMaKhoa is provided, only emit to matching clients
      if (targetMaKhoa && clientMaKhoa !== targetMaKhoa) {
        return; // Skip this client
      }

      try {
        client.enqueue(new TextEncoder().encode(dataString));
        emitCount++;
      } catch (error) {
        clients.delete(client);
      }
    });
    
    console.log(`[NotificationService] Emitted ${eventCode} to ${emitCount} clients (Target: ${targetMaKhoa || 'All'}).`);
  } catch (error) {
    console.error('[NotificationService] Error emitting event:', error);
  }
}
