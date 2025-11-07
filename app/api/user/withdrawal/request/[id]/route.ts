import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const ctx = await params;
    const id = ctx?.id || '';
    const record = await (db as any).withdrawalRequest.findFirst({ where: { id, userId: user.userId } });
    if (!record) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, request: record }, { status: 200 });
  } catch (err: any) {
    console.error('Get withdrawal request failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const ctx = await params;
    const id = ctx?.id || '';
    const body = await req.json();
    const { status } = body || {};
    const normalized = String(status || '').toUpperCase();
    if (!['APPROVED', 'DENIED'].includes(normalized)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }
    const existing = await (db as any).withdrawalRequest.findFirst({ where: { id, userId: user.userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const updated = await (db as any).withdrawalRequest.update({ where: { id }, data: { status: normalized as any } });
    return NextResponse.json({ success: true, request: updated }, { status: 200 });
  } catch (err: any) {
    console.error('User update withdrawal request failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
