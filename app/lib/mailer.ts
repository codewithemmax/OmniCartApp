import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPriceDropEmail(
  to: string,
  query: string,
  price: number,
  maxPrice: number,
  productUrl: string,
  source: string
) {
  await transporter.sendMail({
    from: `"OmniCart Alerts" <${process.env.SMTP_USER}>`,
    to,
    subject: `🔔 Price Drop Alert: "${query}" is now ₦${price.toLocaleString()}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#FF6600">OmniCart Price Alert 🛒</h2>
        <p>Good news! <strong>${query}</strong> just dropped below your target price.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr>
            <td style="padding:8px;background:#fff7f0;border-radius:8px">
              <strong>Current Price:</strong>
              <span style="color:#FF6600;font-size:1.2em;font-weight:bold"> ₦${price.toLocaleString()}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px">
              <strong>Your Target:</strong> ₦${maxPrice.toLocaleString()} &nbsp;|&nbsp;
              <strong>Source:</strong> ${source}
            </td>
          </tr>
        </table>
        <a href="${productUrl}"
           style="display:inline-block;background:#FF6600;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold">
          View on ${source} →
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          You're receiving this because you set a price alert on OmniCart.
        </p>
      </div>
    `,
  });
}
