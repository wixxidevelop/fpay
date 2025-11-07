import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if ('error' in admin) return admin.error;

  try {
    const userId = req.nextUrl.searchParams.get('userId') || undefined;
    const records = await (db as any).withdrawalRequest.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ success: true, requests: records }, { status: 200 });
  } catch (err: any) {
    console.error('Admin list withdrawal requests failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
