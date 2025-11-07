import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
}

// Helper: theme colors
function themePalette(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    return {
      bg: '#0b0b0b',
      card: '#121212',
      text: '#e5e5e5',
      muted: '#9aa0a6',
      brand: '#4f46e5',
      success: '#10b981',
      warn: '#f59e0b',
      border: '#1f2937',
      link: '#60a5fa',
    };
  }
  return {
    bg: '#ffffff',
    card: '#ffffff',
    text: '#171717',
    muted: '#6b7280',
    brand: '#111827',
    success: '#059669',
    warn: '#d97706',
    border: '#e5e7eb',
    link: '#2563eb',
  };
}

function wrapEmail(theme: 'light' | 'dark', title: string, body: string) {
  const c = themePalette(theme);
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_USER || '';
  const unsubscribeUrl = process.env.UNSUBSCRIBE_URL || '#';
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <style>
        body{margin:0;background:${c.bg};color:${c.text};font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif}
        .container{max-width:640px;margin:0 auto;padding:24px}
        .card{background:${c.card};border:1px solid ${c.border};border-radius:12px;padding:24px}
        .h1{font-size:20px;font-weight:700;margin:0 0 12px;color:${c.brand}}
        .p{font-size:14px;line-height:1.6;margin:0 0 16px;color:${c.text}}
        .muted{color:${c.muted}}
        .row{display:flex;justify-content:space-between;border-top:1px dashed ${c.border};padding-top:12px;margin-top:12px}
        .cta{display:inline-block;padding:10px 14px;border-radius:8px;background:${c.brand};color:#fff;text-decoration:none;font-weight:600}
        .warn{color:${c.warn}}
        .success{color:${c.success}}
        .footer{font-size:12px;color:${c.muted};margin-top:16px;border-top:1px solid ${c.border};padding-top:12px}
        .table{width:100%;border-collapse:collapse}
        .table th,.table td{border:1px solid ${c.border};padding:8px;text-align:left;font-size:13px}
        a{color:${c.link}}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1 class="h1">${title}</h1>
          ${body}
          <div class="footer">
            Need help? <a href="mailto:${supportEmail}">${supportEmail || 'Contact support'}</a> · <a href="${unsubscribeUrl}">Unsubscribe</a>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

// Email templates
export function getWelcomeEmailTemplate(username: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to NFT Marketplace</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Welcome to NFT Marketplace!</h1>
        <p>Hello ${username},</p>
        <p>Welcome to our NFT marketplace! Your account has been successfully created.</p>
        <p>You can now:</p>
        <ul>
          <li>Create and mint NFTs</li>
          <li>Buy and sell digital assets</li>
          <li>Participate in auctions</li>
          <li>Build your collection</li>
        </ul>
        <p>Start exploring the marketplace and discover amazing digital art!</p>
        <p>Best regards,<br>The NFT Marketplace Team</p>
      </div>
    </body>
    </html>
  `;
}

export function getUserCreditAlert(theme: 'light' | 'dark', data: { amount: string; txId: string; datetime: string; balance: string; ctaUrl?: string; }): { html: string; text: string } {
  const body = `
    <p class="p">A credit has been added to your account.</p>
    <div class="row"><span class="muted">Amount</span><span class="success">${data.amount}</span></div>
    <div class="row"><span class="muted">Transaction ID</span><span>${data.txId}</span></div>
    <div class="row"><span class="muted">Date/Time</span><span>${data.datetime}</span></div>
    <div class="row"><span class="muted">Available Balance</span><span>${data.balance}</span></div>
    ${data.ctaUrl ? `<p class="p"><a class="cta" href="${data.ctaUrl}">View details</a></p>` : ''}
  `;
  const html = wrapEmail(theme, 'Credit Added', body);
  const text = `Credit Added\nAmount: ${data.amount}\nTransaction ID: ${data.txId}\nDate/Time: ${data.datetime}\nAvailable Balance: ${data.balance}\n${data.ctaUrl ? `Details: ${data.ctaUrl}` : ''}`;
  return { html, text };
}

export function getUserDepositConfirmation(theme: 'light' | 'dark', data: { amount: string; method: string; txId: string; balance: string; }): { html: string; text: string } {
  const body = `
    <p class="p">Your deposit was successful.</p>
    <div class="row"><span class="muted">Deposit Amount</span><span class="success">${data.amount}</span></div>
    <div class="row"><span class="muted">Payment Method</span><span>${data.method}</span></div>
    <div class="row"><span class="muted">Transaction ID</span><span>${data.txId}</span></div>
    <div class="row"><span class="muted">New Balance</span><span>${data.balance}</span></div>
  `;
  const html = wrapEmail(theme, 'Deposit Confirmation', body);
  const text = `Deposit Confirmation\nAmount: ${data.amount}\nMethod: ${data.method}\nTransaction ID: ${data.txId}\nNew Balance: ${data.balance}`;
  return { html, text };
}

export function getUserWithdrawalNotice(theme: 'light' | 'dark', data: { amount: string; destination: string; processingTime: string; }): { html: string; text: string } {
  const body = `
    <p class="p warn">A withdrawal was initiated from your account.</p>
    <table class="table">
      <tr><th>Withdrawal Amount</th><td>${data.amount}</td></tr>
      <tr><th>Destination Account</th><td>${data.destination}</td></tr>
      <tr><th>Processing Time</th><td>${data.processingTime}</td></tr>
    </table>
  `;
  const html = wrapEmail(theme, 'Withdrawal Notice', body);
  const text = `Withdrawal Notice\nAmount: ${data.amount}\nDestination: ${data.destination}\nProcessing Time: ${data.processingTime}`;
  return { html, text };
}

export function getStockBuyReceipt(theme: 'light' | 'dark', data: { symbol: string; quantity: string; pricePerShare: string; totalCost: string; status: string; }): { html: string; text: string } {
  const body = `
    <p class="p">Your stock purchase receipt is attached below.</p>
    <div class="row"><span class="muted">Symbol</span><span>${data.symbol}</span></div>
    <div class="row"><span class="muted">Quantity</span><span>${data.quantity}</span></div>
    <div class="row"><span class="muted">Price/Share</span><span>${data.pricePerShare}</span></div>
    <div class="row"><span class="muted">Total Cost</span><span>${data.totalCost}</span></div>
    <div class="row"><span class="muted">Order Status</span><span>${data.status}</span></div>
  `;
  const html = wrapEmail(theme, 'Stock Purchase Receipt', body);
  const text = `Stock Purchase Receipt\n${data.symbol} x ${data.quantity} @ ${data.pricePerShare}\nTotal: ${data.totalCost}\nStatus: ${data.status}`;
  return { html, text };
}

export function getStockClaimVerification(theme: 'light' | 'dark', data: { claimRef: string; stockDetails: string; code: string; }): { html: string; text: string } {
  const body = `
    <p class="p">Verify your stock claim request.</p>
    <p class="p"><span class="muted">Claim Reference:</span> ${data.claimRef}</p>
    <p class="p"><span class="muted">Stock Details:</span> ${data.stockDetails}</p>
    <p class="p"><span class="muted">Verification Code:</span> <strong>${data.code}</strong></p>
    <p class="p"><span class="muted">Steps:</span> 1) Confirm details 2) Enter code 3) Submit claim</p>
  `;
  const html = wrapEmail(theme, 'Stock Claim Verification', body);
  const text = `Stock Claim Verification\nRef: ${data.claimRef}\nDetails: ${data.stockDetails}\nCode: ${data.code}`;
  return { html, text };
}

// Minimal password reset email
export function getResetPasswordEmail(theme: 'light' | 'dark', data: { username?: string; resetUrl: string; code?: string; }): { html: string; text: string } {
  const body = `
    <p class="p">${data.username ? `Hi ${data.username},` : 'Hello,'} reset your password securely by clicking the link below.</p>
    <p class="p"><a class="cta" href="${data.resetUrl}">Reset Password</a></p>
    ${data.code ? `<p class="p">Or use this code: <strong>${data.code}</strong></p>` : ''}
  `;
  const html = wrapEmail(theme, 'Reset Password', body);
  const text = `Reset Password\nLink: ${data.resetUrl}${data.code ? `\nCode: ${data.code}` : ''}`;
  return { html, text };
}

// Convenience senders
export async function sendUserCreditAlert(to: string, data: Parameters<typeof getUserCreditAlert>[1], theme: 'light' | 'dark' = 'light') {
  const tpl = getUserCreditAlert(theme, data);
  return sendEmail({ to, subject: 'Credit Added', html: tpl.html, text: tpl.text });
}
export async function sendUserDepositConfirmation(to: string, data: Parameters<typeof getUserDepositConfirmation>[1], theme: 'light' | 'dark' = 'light') {
  const tpl = getUserDepositConfirmation(theme, data);
  return sendEmail({ to, subject: 'Deposit Confirmation', html: tpl.html, text: tpl.text });
}
export async function sendUserWithdrawalNotice(to: string, data: Parameters<typeof getUserWithdrawalNotice>[1], theme: 'light' | 'dark' = 'light') {
  const tpl = getUserWithdrawalNotice(theme, data);
  return sendEmail({ to, subject: 'Withdrawal Notice', html: tpl.html, text: tpl.text });
}
export async function sendStockBuyReceipt(to: string, data: Parameters<typeof getStockBuyReceipt>[1], theme: 'light' | 'dark' = 'light') {
  const tpl = getStockBuyReceipt(theme, data);
  return sendEmail({ to, subject: 'Stock Purchase Receipt', html: tpl.html, text: tpl.text });
}
export async function sendStockClaimVerification(to: string, data: Parameters<typeof getStockClaimVerification>[1], theme: 'light' | 'dark' = 'light') {
  const tpl = getStockClaimVerification(theme, data);
  return sendEmail({ to, subject: 'Stock Claim Verification', html: tpl.html, text: tpl.text });
}
export async function sendResetPasswordEmail(to: string, data: Parameters<typeof getResetPasswordEmail>[1], theme: 'light' | 'dark' = 'light') {
  const tpl = getResetPasswordEmail(theme, data);
  return sendEmail({ to, subject: 'Reset your password', html: tpl.html, text: tpl.text });
}

export function getBidNotificationTemplate(
  username: string,
  nftTitle: string,
  bidAmount: string,
  auctionUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Bid on Your NFT</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">New Bid Received!</h1>
        <p>Hello ${username},</p>
        <p>Great news! Someone has placed a new bid on your NFT.</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">NFT: ${nftTitle}</h3>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #059669;">
            New Bid: ${bidAmount} ETH
          </p>
        </div>
        <p>
          <a href="${auctionUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Auction
          </a>
        </p>
        <p>Best regards,<br>The NFT Marketplace Team</p>
      </div>
    </body>
    </html>
  `;
}

export function getAuctionEndedTemplate(
  username: string,
  nftTitle: string,
  finalBid: string,
  isWinner: boolean
): string {
  const title = isWinner ? 'Congratulations! You Won the Auction' : 'Auction Ended';
  const message = isWinner 
    ? 'Congratulations! You have won the auction for this NFT.'
    : 'The auction for your NFT has ended.';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">${title}</h1>
        <p>Hello ${username},</p>
        <p>${message}</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">NFT: ${nftTitle}</h3>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #059669;">
            Final Bid: ${finalBid} ETH
          </p>
        </div>
        <p>The transaction will be processed automatically. You will receive another email once it's completed.</p>
        <p>Best regards,<br>The NFT Marketplace Team</p>
      </div>
    </body>
    </html>
  `;
}

export function getSaleNotificationTemplate(
  username: string,
  nftTitle: string,
  salePrice: string,
  buyerUsername: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>NFT Sold!</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Your NFT Has Been Sold!</h1>
        <p>Hello ${username},</p>
        <p>Great news! Your NFT has been successfully sold.</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">NFT: ${nftTitle}</h3>
          <p style="margin: 0 0 5px 0; font-size: 18px; font-weight: bold; color: #059669;">
            Sale Price: ${salePrice} ETH
          </p>
          <p style="margin: 0;">Buyer: ${buyerUsername}</p>
        </div>
        <p>The payment has been processed and will be transferred to your wallet shortly.</p>
        <p>Best regards,<br>The NFT Marketplace Team</p>
      </div>
    </body>
    </html>
  `;
}

// Email sending functions
export async function sendWelcomeEmail(email: string, username: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: 'Welcome to NFT Marketplace!',
    html: getWelcomeEmailTemplate(username),
  });
}

export async function sendBidNotification(
  email: string,
  username: string,
  nftTitle: string,
  bidAmount: string,
  auctionUrl: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `New bid on your NFT: ${nftTitle}`,
    html: getBidNotificationTemplate(username, nftTitle, bidAmount, auctionUrl),
  });
}

export async function sendAuctionEndedNotification(
  email: string,
  username: string,
  nftTitle: string,
  finalBid: string,
  isWinner: boolean
): Promise<boolean> {
  const subject = isWinner 
    ? `Congratulations! You won: ${nftTitle}`
    : `Auction ended: ${nftTitle}`;
    
  return sendEmail({
    to: email,
    subject,
    html: getAuctionEndedTemplate(username, nftTitle, finalBid, isWinner),
  });
}

export async function sendSaleNotification(
  email: string,
  username: string,
  nftTitle: string,
  salePrice: string,
  buyerUsername: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Your NFT has been sold: ${nftTitle}`,
    html: getSaleNotificationTemplate(username, nftTitle, salePrice, buyerUsername),
  });
}