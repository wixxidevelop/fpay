import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if ('error' in admin) return admin.error;

  try {
    const ctx = await params;
    const id = ctx?.id || '';
    const body = await req.json();
    const { status } = body || {};
    const normalized = String(status || '').toUpperCase();
    if (!['APPROVED', 'DENIED'].includes(normalized)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }
    const updated = await (db as any).withdrawalRequest.update({ where: { id }, data: { status: normalized as any } });
    // If approved, record a withdrawal transaction for traceability
    if (normalized === 'APPROVED') {
      try {
        await db.transaction.create({
          data: {
            userId: updated.userId,
            amount: updated.amount,
            transactionHash: uuidv4(),
            type: 'WITHDRAWAL',
            nftId: null,
          },
        });
      } catch (e) {
        console.error('Recording withdrawal transaction failed', e);
      }
    }
    return NextResponse.json({ success: true, request: updated }, { status: 200 });
  } catch (err: any) {
    console.error('Admin update withdrawal request failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
