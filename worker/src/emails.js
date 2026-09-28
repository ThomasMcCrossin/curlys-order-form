// Customer email templates for Curly's Sports & Supplements.
//
// Design notes (brand read from https://curlys.ca and /pages/contact, 2026-09-28):
// - Identity: the hosted "Curly's / Sports & Supplements" script wordmark (transparent PNG,
//   orange #FCA733 with a dark outline) sits on a near-black band (#111111, the site's nav and
//   primary-button colour). Its alt text is styled orange, so a blocked image still reads as a
//   text wordmark.
// - Colour: black/white base like the storefront. One accent, the logo orange, used for the rule
//   under the header, the reference chip and the single button (#111 text on orange, 9.9:1).
//   Dark mode: `color-scheme` meta plus a prefers-color-scheme block for clients that honour it.
//   Clients that force-invert (Gmail app, Outlook.com) keep the dark header and the orange
//   button readable because neither depends on a white background.
// - Type: Georgia headlines, a nod to the site's Source Serif 4. Body text uses the system sans
//   stack for small-screen legibility. No web fonts, because most clients drop them.
// - Voice: a person at the counter in Amherst. Short, warm, specific, no hype. Staff answer
//   replies personally, so every email ends with "reply or call". We make no promises about
//   hold periods or payment terms (those are owner decisions) and publish no store hours.
// - Structure: hidden preheader, header, eyebrow + headline, short intro, reference chip
//   ("mention it at the counter"), product cards (thumbnail when the variant has an image,
//   otherwise an initial tile), at most one bulletproof button, then a footer with store identity.
// - Every dynamic value goes through escapeHtml(). Every template returns {subject, html, text}.
//
// Pure functions only: no I/O and no env access. index.js decides who gets what and when.

export const STORE = Object.freeze({
  name: "Curly's Sports & Supplements",
  shortName: "Curly's",
  street: "81 South Albion Street",
  locality: "Amherst, NS",
  phoneDisplay: "902-667-2875",
  phoneTel: "+19026672875",
  siteUrl: "https://curlys.ca",
  siteLabel: "curlys.ca",
  logoUrl: "https://curlys.ca/cdn/shop/files/CurlysWriting_1bba3ee3-57c8-498f-b25d-adc31bbfa300.png?v=1683563595&width=480",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Curly%27s+Sports+%26+Supplements%2C+81+South+Albion+Street%2C+Amherst%2C+NS"
});

const C = Object.freeze({
  page: "#F3F1ED",
  card: "#FFFFFF",
  ink: "#111111",
  text: "#1F1F1F",
  muted: "#5E5A55",
  border: "#E4DFD7",
  accent: "#F5A33A",
  accentTint: "#FFF4E3",
  tile: "#F3F1ED"
});

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', Times, serif";

// ---------- primitives ----------

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CAD = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export function formatCad(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return CAD.format(n);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function safeHttpsUrl(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const normalized = s.startsWith("//") ? `https:${s}` : s;
  try {
    const u = new URL(normalized);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function truncate(value, max) {
  const s = cleanText(value);
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

// Turn a Shopify draft line item (possibly enriched) into the fields a card needs.
export function toEmailItem(lineItem) {
  const li = lineItem || {};
  const variantId = li.variant_id || li.variantId || null;
  const rawVariant = cleanText(li.variant_title || li.variantTitle);
  const title = cleanText(li.title || li.name) || (variantId ? `Item #${variantId}` : "Item");
  // displayName from the variant lookup is "Product - Variant"; drop the repeated product part.
  let variant = rawVariant;
  if (variant.startsWith(`${title} - `)) variant = variant.slice(title.length + 3);
  if (variant === title || variant === "Default Title") variant = "";
  const qtyNum = Number(li.quantity);
  const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? Math.floor(qtyNum) : 1;
  const unit = li.price === undefined || li.price === null || li.price === "" ? null : Number(li.price);
  const unitPrice = Number.isFinite(unit) && unit >= 0 ? unit : null;
  return {
    title,
    variant,
    vendor: cleanText(li.vendor),
    sku: cleanText(li.sku),
    qty,
    unitPrice,
    lineTotal: unitPrice === null ? null : Math.round(unitPrice * qty * 100) / 100,
    imageUrl: safeHttpsUrl(li.image_url || li.imageUrl),
    custom: !variantId
  };
}

// ---------- building blocks ----------

function preheaderHtml(text) {
  // Pad with zero-width non-joiners so clients don't pull body copy into the inbox preview.
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(text)}${filler}</div>`;
}

function button(label, href) {
  const url = escapeHtml(href);
  const text = escapeHtml(label);
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
  <tr>
    <td align="center" bgcolor="${C.accent}" class="dm-btn" style="border-radius:4px;background:${C.accent};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:290px;" arcsize="8%" stroke="f" fillcolor="${C.accent}">
        <w:anchorlock/>
        <center style="color:${C.ink};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${text}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${url}" target="_blank" class="dm-btn-a" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:700;line-height:20px;color:${C.ink};text-decoration:none;border-radius:4px;background:${C.accent};mso-hide:all;">${text}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
}

function referenceChip(reference) {
  if (!reference) return "";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px;">
  <tr>
    <td class="dm-chip" style="background:${C.accentTint};border-left:4px solid ${C.accent};padding:12px 16px;font-family:${SANS};">
      <div class="dm-muted" style="font-size:12px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};">Order request</div>
      <div class="dm-text" style="font-size:20px;line-height:26px;font-weight:700;color:${C.text};">${escapeHtml(reference)}</div>
      <div class="dm-muted" style="font-size:13px;line-height:18px;color:${C.muted};">Mention this number at the counter or when you reply.</div>
    </td>
  </tr>
</table>`;
}

function sectionLabel(text) {
  return `<div class="dm-muted" style="margin:0 0 8px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};">${escapeHtml(text)}</div>`;
}

function thumbCell(item) {
  if (item.imageUrl) {
    return `<td width="64" valign="top" style="width:64px;padding:14px 14px 14px 0;">
      <img src="${escapeHtml(item.imageUrl)}" width="62" height="62" alt="" style="display:block;width:62px;height:62px;object-fit:contain;border:1px solid ${C.border};border-radius:6px;background:#FFFFFF;">
    </td>`;
  }
  const initial = escapeHtml((item.title.match(/[A-Za-z0-9]/) || ["•"])[0].toUpperCase());
  return `<td width="64" valign="top" style="width:64px;padding:14px 14px 14px 0;">
    <table role="presentation" width="64" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="64" height="64" align="center" valign="middle" class="dm-tile" style="width:64px;height:64px;background:${C.tile};border-radius:6px;font-family:${SERIF};font-size:26px;color:${C.muted};">${initial}</td>
    </tr></table>
  </td>`;
}

function itemMeta(item, { showSku }) {
  const parts = [];
  if (item.variant) parts.push(item.variant);
  if (item.vendor) parts.push(item.vendor);
  if (showSku && item.sku) parts.push(`SKU ${item.sku}`);
  return parts;
}

function itemRows(items, { showPrice = true, showSku = false, showImages = true } = {}) {
  if (!items.length) {
    return `<tr><td class="dm-muted" style="padding:14px 0;font-family:${SANS};font-size:15px;color:${C.muted};">No items listed. Reply and we'll sort it out.</td></tr>`;
  }
  return items.map((item, i) => {
    const meta = itemMeta(item, { showSku });
    const border = i === 0 ? "" : `border-top:1px solid ${C.border};`;
    const price = showPrice ? formatCad(item.lineTotal) : null;
    const each = showPrice && item.qty > 1 ? formatCad(item.unitPrice) : null;
    const badge = item.custom
      ? `<span class="dm-muted" style="display:inline-block;margin-left:6px;padding:1px 7px;border:1px solid ${C.border};border-radius:999px;font-size:11px;line-height:16px;font-weight:600;color:${C.muted};vertical-align:1px;">Special item</span>`
      : "";
    return `<tr>
  <td class="dm-border" style="${border}padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${showImages ? thumbCell(item) : ""}
      <td valign="top" style="padding:14px 0;font-family:${SANS};">
        <div class="dm-text" style="font-size:15px;line-height:21px;font-weight:600;color:${C.text};word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(item.title)}${badge}</div>
        ${meta.length ? `<div class="dm-muted" style="margin-top:2px;font-size:13px;line-height:18px;color:${C.muted};word-break:break-word;overflow-wrap:anywhere;">${meta.map(escapeHtml).join(" &middot; ")}</div>` : ""}
        <div class="dm-muted" style="margin-top:4px;font-size:13px;line-height:18px;color:${C.muted};">Qty ${item.qty}${each ? ` &middot; ${escapeHtml(each)} each` : ""}</div>
      </td>
      ${price ? `<td valign="top" align="right" class="dm-text" style="padding:14px 0 14px 12px;font-family:${SANS};font-size:15px;line-height:21px;font-weight:600;color:${C.text};white-space:nowrap;">${escapeHtml(price)}</td>` : ""}
    </tr></table>
  </td>
</tr>`;
  }).join("");
}

function itemList(items, options) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${itemRows(items, options)}</table>`;
}

function paragraph(html, extra = "") {
  return `<p class="dm-text" style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:24px;color:${C.text};${extra}">${html}</p>`;
}

function contactLine() {
  return `Changed your mind or have a question? Just reply to this email or call <a href="tel:${STORE.phoneTel}" class="dm-link" style="color:${C.text};font-weight:600;text-decoration:underline;white-space:nowrap;">${STORE.phoneDisplay}</a>.`;
}

function footerHtml() {
  return `
<tr>
  <td align="center" style="padding:24px 24px 8px;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted};" class="dm-muted">
    <strong class="dm-text" style="color:${C.text};">${escapeHtml(STORE.name)}</strong><br>
    ${escapeHtml(STORE.street)}, ${escapeHtml(STORE.locality)}<br>
    <a href="tel:${STORE.phoneTel}" class="dm-muted" style="color:${C.muted};text-decoration:underline;white-space:nowrap;">${STORE.phoneDisplay}</a>
    &nbsp;&middot;&nbsp;
    <a href="${STORE.siteUrl}" class="dm-muted" style="color:${C.muted};text-decoration:underline;">${STORE.siteLabel}</a>
  </td>
</tr>
<tr>
  <td align="center" style="padding:4px 24px 32px;font-family:${SANS};font-size:12px;line-height:18px;color:${C.muted};" class="dm-muted">
    You're receiving this because you placed a special order at ${escapeHtml(STORE.shortName)}.
  </td>
</tr>`;
}

// Full document. `content` is trusted HTML produced by the helpers above.
export function layout({ title, preheader, eyebrow, headline, content, footer = true }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>td,th,div,p,a,h1{font-family:Arial,sans-serif;}</style>
<![endif]-->
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
  @media only screen and (max-width: 620px) {
    .px { padding-left:20px !important; padding-right:20px !important; }
    .h1 { font-size:25px !important; line-height:31px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .dm-bg { background:#141414 !important; }
    .dm-card { background:#1E1E1E !important; }
    .dm-text, .dm-link { color:#F2EFEA !important; }
    .dm-muted { color:#B3ADA5 !important; }
    .dm-border { border-color:#383431 !important; }
    .dm-chip { background:#2B241B !important; }
    .dm-tile { background:#2A2826 !important; color:#B3ADA5 !important; }
    .dm-eyebrow { color:#F5A33A !important; }
  }
  [data-ogsc] .dm-text, [data-ogsc] .dm-link { color:#F2EFEA !important; }
  [data-ogsc] .dm-muted { color:#B3ADA5 !important; }
  [data-ogsb] .dm-bg { background:#141414 !important; }
  [data-ogsb] .dm-card { background:#1E1E1E !important; }
  [data-ogsb] .dm-chip { background:#2B241B !important; }
</style>
</head>
<body class="dm-bg" style="margin:0;padding:0;background:${C.page};">
${preheaderHtml(preheader || headline)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dm-bg" style="background:${C.page};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
        <tr>
          <td align="center" bgcolor="${C.ink}" style="background:${C.ink};padding:22px 24px 18px;border-radius:8px 8px 0 0;">
            <a href="${STORE.siteUrl}" style="text-decoration:none;color:${C.accent};">
              <img src="${STORE.logoUrl}" width="150" height="71" alt="Curly's Sports &amp; Supplements" style="display:block;width:150px;max-width:150px;height:auto;margin:0 auto;font-family:${SERIF};font-size:24px;font-weight:bold;font-style:italic;color:${C.accent};">
            </a>
          </td>
        </tr>
        <tr><td height="4" bgcolor="${C.accent}" style="height:4px;line-height:4px;font-size:4px;background:${C.accent};">&nbsp;</td></tr>
        <tr>
          <td class="dm-card px" bgcolor="${C.card}" style="background:${C.card};padding:32px 40px 16px;border-radius:0 0 8px 8px;">
            ${eyebrow ? `<div style="margin:0 0 8px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B26A0E;" class="dm-eyebrow">${escapeHtml(eyebrow)}</div>` : ""}
            <h1 class="dm-text h1" style="margin:0 0 16px;font-family:${SERIF};font-size:30px;line-height:36px;font-weight:normal;color:${C.text};">${escapeHtml(headline)}</h1>
            ${content}
          </td>
        </tr>
        ${footer ? footerHtml() : ""}
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------- plain text ----------

function textItems(items, { showPrice = true, showSku = false } = {}) {
  if (!items.length) return "- No items listed. Reply and we'll sort it out.";
  return items.map(item => {
    const meta = itemMeta(item, { showSku });
    const price = showPrice ? formatCad(item.lineTotal) : null;
    const each = showPrice && item.qty > 1 ? formatCad(item.unitPrice) : null;
    const lines = [`- ${item.title}${item.custom ? " (special item)" : ""}`];
    if (meta.length) lines.push(`  ${meta.join(" · ")}`);
    lines.push(`  Qty ${item.qty}${each ? ` · ${each} each` : ""}${price ? ` · ${price}` : ""}`);
    return lines.join("\n");
  }).join("\n");
}

function textFooter() {
  return [
    "--",
    STORE.name,
    `${STORE.street}, ${STORE.locality}`,
    `${STORE.phoneDisplay} · ${STORE.siteLabel}`,
    "",
    `You're receiving this because you placed a special order at ${STORE.shortName}.`
  ].join("\n");
}

function textContact() {
  return `Changed your mind or have a question? Just reply to this email or call ${STORE.phoneDisplay}.`;
}

function textReference(reference) {
  return reference ? `Order request ${reference} (mention this number at the counter or when you reply)` : "";
}

function joinText(blocks) {
  return blocks.filter(b => b !== null && b !== undefined && b !== "").join("\n\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

function greeting(firstName) {
  const name = cleanText(firstName);
  return name ? `Hi ${truncate(name, 40)},` : "Hi there,";
}

function toItems(lineItems) {
  return (Array.isArray(lineItems) ? lineItems : []).filter(Boolean).map(toEmailItem);
}

// ---------- customer emails ----------

// Sent when the in-store order form creates a request (/order-request).
export function renderRequestReceivedEmail({ reference, lineItems, firstName }) {
  const items = toItems(lineItems);
  const ref = cleanText(reference);
  const count = items.reduce((n, i) => n + i.qty, 0);
  const headline = count === 1 ? "We're ordering it in for you" : "We're ordering them in for you";
  const preheader = `We'll order ${count === 1 ? "it" : "them"} in and email you the moment ${count === 1 ? "it lands" : "they land"}.${ref ? ` Request ${ref}.` : ""}`;
  const subject = `We've got your order request${ref ? ` ${ref}` : ""} | ${STORE.name}`;

  const content = [
    paragraph(escapeHtml(greeting(firstName))),
    paragraph("Thanks for ordering with us. We'll bring in what you asked for and email you as soon as it arrives."),
    referenceChip(ref),
    sectionLabel(items.length === 1 ? "What you asked for" : `What you asked for (${items.length} items)`),
    itemList(items, { showPrice: true }),
    items.some(i => i.unitPrice !== null) ? `<p class="dm-muted" style="margin:-8px 0 20px;font-family:${SANS};font-size:13px;line-height:18px;color:${C.muted};">Prices shown are before tax.</p>` : "",
    paragraph("Nothing to pay yet. We'll be in touch when it's here."),
    paragraph(contactLine()),
    paragraph(`Thanks,<br>The team at ${escapeHtml(STORE.shortName)}`, "margin-bottom:8px;")
  ].join("\n");

  const text = joinText([
    headline,
    greeting(firstName),
    "Thanks for ordering with us. We'll bring in what you asked for and email you as soon as it arrives.",
    textReference(ref),
    `What you asked for:\n${textItems(items, { showPrice: true })}`,
    items.some(i => i.unitPrice !== null) ? "Prices shown are before tax." : "",
    "Nothing to pay yet. We'll be in touch when it's here.",
    textContact(),
    `Thanks,\nThe team at ${STORE.shortName}`,
    textFooter()
  ]);

  return { subject, html: layout({ title: subject, preheader, eyebrow: "Request received", headline, content }), text };
}

// Sent by the Shopify Flow back-in-stock hook for the one variant that just arrived.
// `otherLineItems` are the rest of the draft that has not had its own in-stock email yet.
export function renderBackInStockEmail({ reference, lineItem, otherLineItems = [], invoiceToFollow = false, firstName }) {
  const item = toEmailItem(lineItem || {});
  const others = toItems(otherLineItems);
  const ref = cleanText(reference);
  const headline = "Good news, it's in";
  const subject = `Now in stock: ${truncate(item.title, 80)} | ${STORE.shortName}`;
  const preheader = `${truncate(item.title, 60)} just arrived and we've set it aside for you.`;

  const payLine = invoiceToFollow
    ? `A payment link for your ${others.length ? "whole order" : "order"} will follow in a separate email from Shopify if you'd like to pay ahead. You can also pay in store when you pick it up.`
    : "You can pay in store when you pick it up.";

  const content = [
    paragraph(escapeHtml(greeting(firstName))),
    paragraph("The item you ordered just arrived. We've set it aside for you at the store."),
    referenceChip(ref),
    sectionLabel("Now in stock"),
    itemList([item], { showPrice: true }),
    others.length ? sectionLabel("Still on the way") : "",
    others.length ? itemList(others, { showPrice: false, showImages: false }) : "",
    others.length ? paragraph("We'll email you again as the rest comes in.") : "",
    paragraph(payLine),
    button("Get directions to the store", STORE.mapsUrl),
    `<div style="height:12px;line-height:12px;font-size:12px;">&nbsp;</div>`,
    paragraph(contactLine()),
    paragraph(`See you soon,<br>The team at ${escapeHtml(STORE.shortName)}`, "margin-bottom:8px;")
  ].join("\n");

  const text = joinText([
    headline,
    greeting(firstName),
    "The item you ordered just arrived. We've set it aside for you at the store.",
    textReference(ref),
    `Now in stock:\n${textItems([item], { showPrice: true })}`,
    others.length ? `Still on the way:\n${textItems(others, { showPrice: false })}\n\nWe'll email you again as the rest comes in.` : "",
    payLine,
    `Find us: ${STORE.street}, ${STORE.locality}\n${STORE.mapsUrl}`,
    textContact(),
    `See you soon,\nThe team at ${STORE.shortName}`,
    textFooter()
  ]);

  return { subject, html: layout({ title: subject, preheader, eyebrow: "Back in stock", headline, content }), text };
}

// Sent from the staff dashboard "email customer" action. `message` is typed by staff.
export function renderReadyForPickupEmail({ reference, lineItems, message, firstName }) {
  const items = toItems(lineItems);
  const ref = cleanText(reference);
  const staffMessage = String(message ?? "").trim();
  const headline = items.length > 1 ? "Everything's here and waiting for you" : "It's here and waiting for you";
  const subject = `Ready for pickup: order ${ref || "request"} | ${STORE.name}`;
  const preheader = staffMessage
    ? truncate(staffMessage, 110)
    : "Everything's in and waiting for you at the store.";

  const noteHtml = staffMessage
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>
        <td class="dm-border" style="border-left:3px solid ${C.border};padding:4px 0 4px 16px;font-family:${SANS};font-size:16px;line-height:24px;color:${C.text};">
          <div class="dm-muted" style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};margin-bottom:4px;">A note from the store</div>
          <div class="dm-text" style="color:${C.text};word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(staffMessage).replace(/\r?\n/g, "<br>")}</div>
        </td></tr></table>`
    : "";

  const content = [
    paragraph(escapeHtml(greeting(firstName))),
    paragraph("Your order has arrived and is waiting for you at the store. Drop in whenever it suits you."),
    noteHtml,
    referenceChip(ref),
    sectionLabel(items.length === 1 ? "Ready for you" : `Ready for you (${items.length} items)`),
    itemList(items, { showPrice: false, showSku: true }),
    paragraph("Would you rather pay ahead? Reply and we'll send you a payment link."),
    button("Get directions to the store", STORE.mapsUrl),
    `<div style="height:12px;line-height:12px;font-size:12px;">&nbsp;</div>`,
    paragraph(contactLine()),
    paragraph(`See you soon,<br>The team at ${escapeHtml(STORE.shortName)}`, "margin-bottom:8px;")
  ].join("\n");

  const text = joinText([
    headline,
    greeting(firstName),
    "Your order has arrived and is waiting for you at the store. Drop in whenever it suits you.",
    staffMessage ? `A note from the store:\n${staffMessage}` : "",
    textReference(ref),
    `Ready for you:\n${textItems(items, { showPrice: false, showSku: true })}`,
    "Would you rather pay ahead? Reply and we'll send you a payment link.",
    `Find us: ${STORE.street}, ${STORE.locality}\n${STORE.mapsUrl}`,
    textContact(),
    `See you soon,\nThe team at ${STORE.shortName}`,
    textFooter()
  ]);

  return { subject, html: layout({ title: subject, preheader, eyebrow: "Ready for pickup", headline, content }), text };
}

// Plain-text custom_message placed inside Shopify's own draft-order invoice email.
// Shopify renders the surrounding invoice from its admin template, not from this code.
export function invoiceCustomMessage() {
  return `Here's the payment link for your special order from ${STORE.shortName}. `
    + "Pay online if you'd like it sorted before you come in, or pay in store at pickup. "
    + `Questions or changes? Reply to our email or call ${STORE.phoneDisplay}. Thanks!`;
}

// ---------- staff emails ----------

// Light shared frame for internal notifications. Content stays exactly what staff already
// get; callers pass already-escaped HTML.
export function wrapStaffEmail({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title || "Curly's order form")}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};"><tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;">
<tr><td bgcolor="${C.ink}" style="background:${C.ink};padding:10px 20px;border-radius:6px 6px 0 0;border-bottom:3px solid ${C.accent};font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.accent};">Curly's order form &middot; staff</td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};padding:20px;border-radius:0 0 6px 6px;font-family:${SANS};font-size:15px;line-height:22px;color:${C.text};word-break:break-word;">
${bodyHtml}
</td></tr></table>
</td></tr></table>
</body></html>`;
}
