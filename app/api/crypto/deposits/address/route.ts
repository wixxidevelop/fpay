import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { asset, network } = body || {};
    if (!asset || !network) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: asset, network' },
        { status: 400 }
      );
    }

    const record = await db.cryptoDepositAddress.findUnique({
      where: {
        userId_asset_network: {
          userId: auth.user.userId,
          asset,
          network,
        },
      },
    });

    if (!record) {
      // Fallback to system settings: depositAddress_<ASSET>_<network>
      const key = `depositAddress_${asset}_${network}`;
      const setting = await db.systemSetting.findUnique({ where: { key } });

      if (!setting) {
        return NextResponse.json(
          { success: false, error: 'Deposit address not set. Please contact support.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          address: setting.value,
          asset,
          network,
          minDepositUSD: 10,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        address: record.address,
        asset: record.asset,
        network: record.network,
        minDepositUSD: 10,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('User deposit address fetch failed', err);
    return NextResponse.json(
      { success: false, error: 'Database operation failed', details: err?.message },
      { status: 500 }
    );
  }
}