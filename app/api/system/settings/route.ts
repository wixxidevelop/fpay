import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Public: return selected system settings for client use
export async function GET(req: NextRequest) {
  try {
    const keys = ['platform.supportEmail', 'platform.headerEmail', 'platform.name', 'platform.description'];
    const records = await db.systemSetting.findMany({ where: { key: { in: keys } } });
    const map: Record<string, string> = {};
    for (const r of records) map[r.key] = r.value;
    return NextResponse.json({ success: true, settings: {
      supportEmail: map['platform.supportEmail'] || '',
      headerEmail: map['platform.headerEmail'] || map['platform.supportEmail'] || '',
      name: map['platform.name'] || 'NFT Marketplace',
      description: map['platform.description'] || '',
    } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to load settings' }, { status: 500 });
  }
}