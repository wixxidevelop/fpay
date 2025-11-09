import { NextRequest, NextResponse } from 'next/server';
import { CURRENCIES } from '@/lib/currencies';

// GET /api/system/currencies - List supported world currencies
export async function GET(_req: NextRequest) {
  return NextResponse.json({ success: true, currencies: CURRENCIES });
}

