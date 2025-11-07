import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/transactions/[id] - Get specific transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transaction = await db.transaction.findUnique({
      where: { id },
      include: {
        nft: {
          select: {
            id: true,
            name: true,
            description: true,
            image: true,
            tokenId: true,
            price: true,
            collection: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            walletAddress: true,
          }
        }
      }
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction,
    });

  } catch (error: any) {
    console.error('Get transaction error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}