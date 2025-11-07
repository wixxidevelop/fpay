import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if ('error' in admin) return admin.error;

  try {
    const body = await req.json();
    const { userId, asset, network, address } = body || {};

    if (!userId || !asset || !network || !address) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, asset, network, address' },
        { status: 400 }
      );
    }

    // Upsert on unique (userId, asset, network)
    const record = await db.cryptoDepositAddress.upsert({
      where: {
        userId_asset_network: { userId, asset, network },
      },
      update: {
        address,
      },
      create: {
        userId,
        asset,
        network,
        address,
      },
    });

    return NextResponse.json({ success: true, address: record.address, record }, { status: 200 });
  } catch (err: any) {
    console.error('Admin upsert deposit address failed', err);
    return NextResponse.json(
      { success: false, error: 'Database operation failed', details: err?.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if ('error' in admin) return admin.error;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;
    const asset = searchParams.get('asset') || undefined;
    const network = searchParams.get('network') || undefined;
    const limitStr = searchParams.get('limit');
    const take = limitStr ? Math.min(Number(limitStr) || 20, 100) : 20;

    const where: any = {};
    if (userId) where.userId = userId;
    if (asset) where.asset = asset;
    if (network) where.network = network;

    const records = await db.cryptoDepositAddress.findMany({
      where,
      take,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ success: true, records }, { status: 200 });
  } catch (err: any) {
    console.error('Admin list deposit addresses failed', err);
    return NextResponse.json(
      { success: false, error: 'Database operation failed', details: err?.message },
      { status: 500 }
    );
  }
}