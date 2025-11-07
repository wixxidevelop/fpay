import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/admin/dashboard - Get admin dashboard statistics
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { user } = authResult;
    
    if (!user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get current date for time-based queries
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get comprehensive statistics
    const [
      // Total counts
      totalUsers,
      totalNFTs,
      totalCollections,
      totalTransactions,
      totalAuctions,
      totalBids,

      // Today's stats
      todayUsers,
      todayNFTs,
      todayTransactions,
      todayVolume,

      // Weekly stats
      weeklyUsers,
      weeklyNFTs,
      weeklyTransactions,
      weeklyVolume,

      // Monthly stats
      monthlyUsers,
      monthlyNFTs,
      monthlyTransactions,
      monthlyVolume,

      // Yearly stats
      yearlyVolume,

      // Active auctions
      activeAuctions,

      // Top collections by volume
      topCollections,

      // Top users by volume
      topUsers,

      // Recent activity
      recentTransactions,

      // Platform revenue (assuming 2.5% fee)
      totalPlatformRevenue,

    ] = await Promise.all([
      // Total counts
      db.user.count(),
      db.nFT.count(),
      db.collection.count(),
      db.transaction.count(),
      db.auction.count(),
      db.bid.count(),

      // Today's stats
      db.user.count({
        where: { createdAt: { gte: startOfToday } }
      }),
      db.nFT.count({
        where: { createdAt: { gte: startOfToday } }
      }),
      db.transaction.count({
        where: { 
          createdAt: { gte: startOfToday }
        }
      }),
      db.transaction.aggregate({
        where: { 
          createdAt: { gte: startOfToday },
          type: 'SALE'
        },
        _sum: { amount: true }
      }),

      // Weekly stats
      db.user.count({
        where: { createdAt: { gte: startOfWeek } }
      }),
      db.nFT.count({
        where: { createdAt: { gte: startOfWeek } }
      }),
      db.transaction.count({
        where: { 
          createdAt: { gte: startOfWeek }
        }
      }),
      db.transaction.aggregate({
        where: { 
          createdAt: { gte: startOfWeek },
          type: 'SALE'
        },
        _sum: { amount: true }
      }),

      // Monthly stats
      db.user.count({
        where: { createdAt: { gte: startOfMonth } }
      }),
      db.nFT.count({
        where: { createdAt: { gte: startOfMonth } }
      }),
      db.transaction.count({
        where: { 
          createdAt: { gte: startOfMonth }
        }
      }),
      db.transaction.aggregate({
        where: { 
          createdAt: { gte: startOfMonth },
          type: 'SALE'
        },
        _sum: { amount: true }
      }),

      // Yearly stats
      db.transaction.aggregate({
        where: { 
          createdAt: { gte: startOfYear },
          type: 'SALE'
        },
        _sum: { amount: true }
      }),

      // Active auctions
      db.auction.count({
        where: { 
          isActive: true,
          endTime: { gt: now }
        }
      }),

      // Top collections by NFT count
      db.collection.findMany({
        take: 10,
        select: {
          id: true,
          name: true,
          image: true,
          _count: {
            select: { nfts: true }
          }
        },
        orderBy: { 
          nfts: { _count: 'desc' }
        }
      }),

      // Top users by transaction count
      db.user.findMany({
        take: 10,
        select: {
          id: true,
          username: true,
          avatar: true,
          isVerified: true,
          _count: {
            select: {
              transactions: true,
            }
          }
        },
        orderBy: {
          transactions: {
            _count: 'desc'
          }
        }
      }),

      // Recent transactions
      db.transaction.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          nft: {
            select: {
              id: true,
              name: true,
              image: true,
              tokenId: true,
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            }
          }
        }
      }),

      // Platform revenue calculation
      db.transaction.aggregate({
        where: { 
          type: 'SALE'
        },
        _sum: { amount: true }
      }),
    ]);

    // Calculate platform revenue (assuming 2.5% fee)
    const platformRevenue = (totalPlatformRevenue._sum.amount || 0) * 0.025;

    // Calculate growth rates
    const userGrowthRate = totalUsers > 0 ? ((weeklyUsers / totalUsers) * 100) : 0;
    const nftGrowthRate = totalNFTs > 0 ? ((weeklyNFTs / totalNFTs) * 100) : 0;
    const volumeGrowthRate = (weeklyVolume._sum.amount || 0) > 0 && (monthlyVolume._sum.amount || 0) > 0 
      ? (((weeklyVolume._sum.amount || 0) / (monthlyVolume._sum.amount || 0)) * 100) : 0;

    const dashboardStats = {
      overview: {
        totalUsers,
        totalNFTs,
        totalCollections,
        totalTransactions,
        totalAuctions,
        totalBids,
        activeAuctions,
        platformRevenue,
      },
      
      today: {
        newUsers: todayUsers,
        newNFTs: todayNFTs,
        transactions: todayTransactions,
        volume: todayVolume._sum.amount || 0,
      },

      thisWeek: {
        newUsers: weeklyUsers,
        newNFTs: weeklyNFTs,
        transactions: weeklyTransactions,
        volume: weeklyVolume._sum.amount || 0,
      },

      thisMonth: {
        newUsers: monthlyUsers,
        newNFTs: monthlyNFTs,
        transactions: monthlyTransactions,
        volume: monthlyVolume._sum.amount || 0,
      },

      thisYear: {
        volume: yearlyVolume._sum.amount || 0,
      },

      growth: {
        userGrowthRate: Math.round(userGrowthRate * 100) / 100,
        nftGrowthRate: Math.round(nftGrowthRate * 100) / 100,
        volumeGrowthRate: Math.round(volumeGrowthRate * 100) / 100,
      },

      topCollections,
      topUsers,
      recentTransactions,
    };

    return NextResponse.json({
      success: true,
      stats: dashboardStats,
    });

  } catch (error: any) {
    console.error('Get admin dashboard error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
