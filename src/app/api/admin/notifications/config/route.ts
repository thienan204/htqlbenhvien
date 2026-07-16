import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.notificationSetting.findMany({
      orderBy: { eventCode: 'asc' },
    });
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error fetching notification settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { eventCode, eventName, isEnabled, titleTemplate, messageTemplate, linkUrl } = await req.json();

    if (!eventCode || typeof isEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const updated = await prisma.notificationSetting.upsert({
      where: { eventCode },
      update: { 
        isEnabled,
        titleTemplate: titleTemplate !== undefined ? titleTemplate : undefined,
        messageTemplate: messageTemplate !== undefined ? messageTemplate : undefined,
        linkUrl: linkUrl !== undefined ? linkUrl : undefined,
      },
      create: {
        eventCode,
        eventName: eventName || eventCode,
        isEnabled,
        titleTemplate,
        messageTemplate,
        linkUrl,
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating notification setting:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventCode = searchParams.get('eventCode');

    if (!eventCode) {
      return NextResponse.json({ error: 'Missing eventCode' }, { status: 400 });
    }

    await prisma.notificationSetting.delete({
      where: { eventCode },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting notification setting:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
