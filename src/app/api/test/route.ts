// SMTP connection test endpoint.
//
// Verifies the supplied Gmail credentials and sends a single test email to
// the sender's own address so the user can confirm the config works before
// running a real bulk send. Credentials are never persisted server-side.

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

interface TestPayload {
  smtp: {
    fromName: string;
    fromEmail: string;
    appPassword: string;
    host: string;
    port: number;
  };
  /** optional override; defaults to sending to the sender's own address */
  to?: string;
}

export async function POST(req: Request) {
  let payload: TestPayload;
  try {
    payload = (await req.json()) as TestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { smtp } = payload;
  if (!smtp?.fromEmail || !smtp?.appPassword) {
    return NextResponse.json(
      { error: "Sender email and App Password are required." },
      { status: 400 }
    );
  }

  const to = (payload.to || smtp.fromEmail).trim();
  const port = Number(smtp.port) || 465;

  const transporter = nodemailer.createTransport({
    host: smtp.host || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: smtp.fromEmail, pass: smtp.appPassword },
  });

  // Fail fast with a clear message if the login is wrong.
  try {
    await transporter.verify();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "SMTP login failed. For Gmail, confirm 2-Step Verification is on and you are using a 16-character App Password (not your normal password).",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 401 }
    );
  }

  const from = smtp.fromName
    ? `"${smtp.fromName.replace(/"/g, "")}" <${smtp.fromEmail}>`
    : smtp.fromEmail;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: "✅ BulkPilot test email",
      html: `
        <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#14110f">
          <h2 style="margin:0 0 8px">Your SMTP setup works 🎉</h2>
          <p>This is a test message sent from <strong>BulkPilot</strong>.</p>
          <p style="color:#666;font-size:13px">
            Sender: ${from}<br/>
            Host: ${smtp.host || "smtp.gmail.com"}:${port}
          </p>
          <p style="color:#999;font-size:12px">If you received this, you're ready to send a bulk campaign.</p>
        </div>`,
    });
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Login succeeded but sending the test email failed.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
