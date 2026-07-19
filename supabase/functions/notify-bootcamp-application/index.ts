import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const NOTIFY_TO      = Deno.env.get("NOTIFY_EMAIL") ?? "founder@stagebuddy.app";
const FROM_ADDRESS   = Deno.env.get("FROM_EMAIL")   ?? "Stage Buddy <no-reply@stagebuddy.app>";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    // Supabase Database Webhooks send { type, table, record, schema, old_record }
    const body = await req.json();
    payload = body.record ?? body;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const {
    name, email, phone, social_handle, track_selected,
    q1, q2, q3, q4, q5, submitted_at,
  } = payload as Record<string, string>;

  const trackLabel = track_selected ?? "Unknown";
  const submittedAt = submitted_at
    ? new Date(submitted_at).toLocaleString("en-US", { timeZone: "America/New_York" })
    : "just now";

  // ── 1. Notify B Rockstar ──────────────────────────────────────────────────

  const adminHtml = `
<h2>New Bootcamp Application — ${trackLabel}</h2>
<p><strong>Submitted:</strong> ${submittedAt} ET</p>
<hr />
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
${phone    ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
${social_handle ? `<p><strong>Social:</strong> ${social_handle}</p>` : ""}
<hr />
<p><strong>Q1:</strong> ${q1 ?? "—"}</p>
<p><strong>Q2:</strong> ${q2 ?? "—"}</p>
<p><strong>Q3:</strong> ${q3 ?? "—"}</p>
<p><strong>Q4:</strong> ${q4 ?? "—"}</p>
<p><strong>Q5:</strong> ${q5 ?? "—"}</p>
`.trim();

  const adminRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to:   [NOTIFY_TO],
      subject: `[Bootcamp App] ${name} — ${trackLabel}`,
      html: adminHtml,
    }),
  });

  if (!adminRes.ok) {
    console.error("Resend admin notify failed:", await adminRes.text());
  }

  // ── 2. Confirm to applicant ───────────────────────────────────────────────

  const isPerformer = trackLabel.toLowerCase().includes("performer") ||
                      trackLabel.toLowerCase().includes("elite");

  const confirmHtml = `
<p>Hey ${name},</p>
<p>
  Your application for the <strong>${trackLabel}</strong> has been received.
  B Rockstar reviews every application personally — you'll hear back within a few days.
</p>
<p>
  In the meantime, feel free to explore upcoming events and resources at
  <a href="https://stagebuddy.app">stagebuddy.app</a>.
</p>
${isPerformer
  ? `<p>Prepare to go deep. The Elite Bootcamp is built to transform your performance from the inside out.</p>`
  : `<p>You took the first step. That already says something about you.</p>`
}
<p>— B Rockstar &amp; the Stage Buddy team</p>
`.trim();

  const confirmRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to:   [email],
      subject: "Your Stage Buddy Bootcamp application is in.",
      html: confirmHtml,
    }),
  });

  if (!confirmRes.ok) {
    console.error("Resend applicant confirm failed:", await confirmRes.text());
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
