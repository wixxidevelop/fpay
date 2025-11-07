import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET: list all system settings (admin only)
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if ('error' in admin) return admin.error;

  try {
    const records = await db.systemSetting.findMany({ orderBy: { updatedAt: 'desc' } });
    const settings: Record<string, { value: string; description?: string; updatedAt?: string }> = {};
    for (const r of records) {
      settings[r.key] = { value: r.value, description: r.description ?? undefined, updatedAt: r.updatedAt.toISOString() };
    }
    return NextResponse.json({ success: true, settings }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to load settings' }, { status: 500 });
  }
}

// PUT: update one or more settings (admin only)
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if ('error' in admin) return admin.error;

  try {
    const body = await req.json();
    const items: Array<{ key: string; value: string; description?: string; category?: string }> = body?.settings || [];
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No settings provided' }, { status: 400 });
    }

    const updated: Record<string, { value: string; description?: string; updatedAt?: string }> = {};
    for (const item of items) {
      if (!item?.key) continue;
      const record = await db.systemSetting.upsert({
        where: { key: item.key },
        update: { value: String(item.value ?? ''), description: item.description ?? null, category: item.category ?? null },
        create: { key: item.key, value: String(item.value ?? ''), description: item.description ?? null, category: item.category ?? null },
      });
      updated[record.key] = { value: record.value, description: record.description ?? undefined, updatedAt: record.updatedAt.toISOString() };
    }
    return NextResponse.json({ success: true, message: 'Settings updated', settings: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to update settings' }, { status: 500 });
  }
}
