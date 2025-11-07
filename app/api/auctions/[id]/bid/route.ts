import { NextRequest, NextResponse } from 'next/server';
import { db, handleDatabaseError } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendBidNotification } from '@/lib/email';
import { bidCreateSchema } from '@/lib/validations';
import { v4 as uuidv4 } from 'uuid';

// POST /api/auctions/[id]/bid - Place bid on auction
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
    const { id: auctionId } = await params;
    const body = await request.json();
    
    // Validate request body
    const validation = bidCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.issues
        },
        { status: 400 }
      );
    }

    const { amount } = validation.data;

    // Get auction details
    const auction = await db.auction.findUnique({
      where: { id: auctionId },
      include: {
        nft: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                email: true,
              }
            }
          }
        },
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
          include: {
            bidder: {
              select: {
                id: true,
                username: true,
              }
            }
          }
        }
      }
    });

    if (!auction) {
      return NextResponse.json(
        { success: false, error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Check if auction is active
    if (!auction.isActive) {
      return NextResponse.json(
        { success: false, error: 'Auction is not active' },
        { status: 400 }
      );
    }

    // Check if auction has ended
    if (auction.endTime <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'Auction has ended' },
        { status: 400 }
      );
    }

    // Check if user is trying to bid on their own NFT
    if (auction.nft.owner && auction.nft.owner.id === user.userId) {
      return NextResponse.json(
        { success: false, error: 'You cannot bid on your own NFT' },
        { status: 400 }
      );
    }

    // Get current highest bid
    const currentHighestBid = auction.bids[0];
    const minimumBid = currentHighestBid ? currentHighestBid.amount + 0.01 : auction.startPrice;

    // Check if bid amount is sufficient
    if (amount < minimumBid) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Bid must be at least ${minimumBid} ETH`,
          minimumBid 
        },
        { status: 400 }
      );
    }

    // Check if user is trying to outbid themselves
    if (currentHighestBid && currentHighestBid.bidder.id === user.userId) {
      return NextResponse.json(
        { success: false, error: 'You already have the highest bid' },
        { status: 400 }
      );
    }

    // Create bid
    const bid = await db.bid.create({
      data: {
        id: uuidv4(),
        auctionId,
        nftId: auction.nftId,
        bidderId: user.userId,
        amount,
      },
      include: {
        bidder: {
          select: {
            id: true,
            username: true,
            avatar: true,
          }
        },
        auction: {
          include: {
            nft: {
              select: {
                id: true,
                name: true,
                image: true,
              }
            }
          }
        }
      }
    });

    // Send notification to NFT owner (don't wait for it)
    const auctionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auctions/${auctionId}`;
    if (auction.nft.owner) {
      sendBidNotification(
        auction.nft.owner.email,
        auction.nft.owner.username,
        auction.nft.name,
        amount.toString(),
        auctionUrl
      ).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Bid placed successfully',
      bid,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Place bid error:', error);
    
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