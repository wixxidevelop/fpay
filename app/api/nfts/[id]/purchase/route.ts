import { NextRequest, NextResponse } from 'next/server';
import { db, handleDatabaseError } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendSaleNotification } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';

// POST /api/nfts/[id]/purchase - Purchase NFT
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { user } = authResult;
    const { id: nftId } = await params;

    // Get NFT details
    const nft = await db.nFT.findUnique({
      where: { id: nftId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        },
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        }
      }
    });

    if (!nft) {
      return NextResponse.json(
        { success: false, error: 'NFT not found' },
        { status: 404 }
      );
    }

    // Check if NFT is available for purchase
    if (!nft.isListed || nft.isSold) {
      return NextResponse.json(
        { success: false, error: 'NFT is not available for purchase' },
        { status: 400 }
      );
    }

    // Check if user is trying to buy their own NFT
    if (nft.ownerId === user.userId) {
      return NextResponse.json(
        { success: false, error: 'You cannot purchase your own NFT' },
        { status: 400 }
      );
    }

    // Check if there's an active auction
    const activeAuction = await db.auction.findFirst({
      where: {
        nftId,
        isActive: true,
        endTime: { gt: new Date() }
      }
    });

    if (activeAuction) {
      return NextResponse.json(
        { success: false, error: 'NFT is currently in an active auction' },
        { status: 400 }
      );
    }

    // Check if NFT has a valid price
    if (!nft.price || nft.price <= 0) {
      return NextResponse.json(
        { success: false, error: 'NFT does not have a valid price' },
        { status: 400 }
      );
    }

    // Start transaction
    const result = await db.$transaction(async (tx) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          id: uuidv4(),
          type: 'SALE',
          nftId,
          userId: user.userId,
          amount: nft.price!,
          transactionHash: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
        include: {
          nft: {
            select: {
              id: true,
              name: true,
              image: true,
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            }
          }
        }
      });

      // Update NFT ownership
      const updatedNFT = await tx.nFT.update({
        where: { id: nftId },
        data: {
          ownerId: user.userId,
          isSold: true,
          isListed: false,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              avatar: true,
            }
          },
          owner: {
            select: {
              id: true,
              username: true,
              avatar: true,
            }
          },
          collection: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      return { transaction, nft: updatedNFT };
    });

    // Send notification emails (don't wait for them)
    if (nft.owner) {
      sendSaleNotification(
        nft.owner.email,
        nft.owner.username,
        nft.name,
        nft.price!.toString(),
        user.username
      ).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      message: 'NFT purchased successfully',
      transaction: result.transaction,
      nft: result.nft,
    });

  } catch (error: any) {
    console.error('Purchase NFT error:', error);
    
    // Handle database errors
    if (error.code?.startsWith('P')) {
      const dbError = handleDatabaseError(error);
      return NextResponse.json(dbError, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}