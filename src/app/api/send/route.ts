// Server-side bulk send endpoint.
//
// The browser cannot open an SMTP socket, so the client posts the SMTP
// config + already-rendered messages here and nodemailer relays them.
// SMTP credentials are NEVER persisted server-side — they live only in the
// caller's localStorage and travel with each request.

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
// Bulk sends can take a while; give the route generous headroom.
export const maxDuration = 300;

interface AttachmentPayload {
  filename: string;
  contentType: string;
  /** base64 data URL */
  dataUrl: string;
}

interface MessagePayload {
  to: string;
  subject: string;
  /** rendered HTML/text body */
  html: string;
}

interface SendPayload {
  smtp: {
    fromName: string;
    fromEmail: string;
    appPassword: string;
    host: string;
    port: number;
  };
  messages: MessagePayload[];
  attachments: AttachmentPayload[];
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Buffer.from(base64, "base64");
}

export async function POST(req: Request) {
  let payload: SendPayload;
  try {
    payload = (await req.json()) as SendPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { smtp, messages, attachments } = payload;

  if (!smtp?.fromEmail || !smtp?.appPassword) {
    return NextResponse.json(
      { error: "SMTP config is incomplete." },
      { status: 400 }
    );
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "No messages to send." },
      { status: 400 }
    );
  }

  const port = Number(smtp.port) || 465;
  const transporter = nodemailer.createTransport({
    host: smtp.host || "smtp.gmail.com",
    port,
    secure: port === 465, // 465 => SSL, 587 => STARTTLS
    auth: {
      user: smtp.fromEmail,
      pass: smtp.appPassword,
    },
  });

  // Verify credentials once up front so we fail fast with a clear message.
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

  // Build attachments once; reused for every recipient (same files for all).
  const mailAttachments = (attachments ?? []).map((a) => ({
    filename: a.filename,
    content: dataUrlToBuffer(a.dataUrl),
    contentType: a.contentType,
  }));

  const from = smtp.fromName
    ? `"${smtp.fromName.replace(/"/g, "")}" <${smtp.fromEmail}>`
    : smtp.fromEmail;

  const results: { email: string; ok: boolean; error?: string }[] = [];

  // Send sequentially to stay well under Gmail's rate/spam thresholds.
  for (const msg of messages) {
    try {
      await transporter.sendMail({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        attachments: mailAttachments,
      });
      results.push({ email: msg.to, ok: true });
    } catch (err) {
      results.push({
        email: msg.to,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({
    sent,
    failed: results.length - sent,
    results,
  });
}
