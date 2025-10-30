export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });

    // Health check
    if (url.pathname === "/health") return new Response("OK", { headers: cors() });

    // === NEW: CUSTOMER SEARCH API ===
    if (url.pathname === "/api/customers/search" && request.method === "GET") {
      try {
        const query = url.searchParams.get("q");
        if (!query || query.length < 2) {
          return json({ customers: [] }, 200);
        }

        // Search customers using Shopify REST API
        // The search query supports: email, phone, name, etc.
        const searchQuery = encodeURIComponent(query);
        const customers = await shopifyRest(
          env,
          `/customers/search.json?query=${searchQuery}&limit=10`
        );

        // Format response for autocomplete
        const results = (customers?.customers || []).map(c => ({
          id: c.id,
          firstName: c.first_name || "",
          lastName: c.last_name || "",
          email: c.email || "",
          phone: c.phone || "",
          fullName: `${c.first_name || ""} ${c.last_name || ""}`.trim()
        }));

        return json({ customers: results }, 200);
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // === NEW: PRODUCT SEARCH API ===
    if (url.pathname === "/api/products/search" && request.method === "GET") {
      try {
        const query = url.searchParams.get("q");
        if (!query || query.length < 2) {
          return json({ products: [] }, 200);
        }

        // Use GraphQL for more efficient product search
        const searchQuery = query.trim();

        // Try barcode search first if query looks like a barcode (numbers/alphanumeric)
        let results = [];

        // Search by barcode using GraphQL (include all statuses: active, draft, archived)
        const barcodeData = await shopifyGraphQL(env, `
          query($q:String!) {
            productVariants(first: 10, query: $q) {
              edges {
                node {
                  legacyResourceId
                  barcode
                  sku
                  displayName
                  price
                  inventoryQuantity
                  product {
                    id
                    title
                    vendor
                    status
                    featuredImage {
                      url(transform: { maxWidth: 100 })
                    }
                  }
                }
              }
            }
          }
        `, { q: `(barcode:${searchQuery}) AND (status:ACTIVE OR status:DRAFT OR status:ARCHIVED)` });

        results = (barcodeData?.productVariants?.edges || []).map(edge => ({
          type: 'variant', // Mark as individual variant (barcode match)
          variantId: edge.node.legacyResourceId,
          productTitle: edge.node.product.title,
          vendor: edge.node.product.vendor || "",
          status: edge.node.product.status,
          variantTitle: edge.node.displayName || "Default Title",
          price: edge.node.price,
          sku: edge.node.sku || "",
          barcode: edge.node.barcode || "",
          inventoryQuantity: edge.node.inventoryQuantity || 0,
          image: edge.node.product.featuredImage?.url || null
        }));

        // Sort barcode results: ACTIVE first, then DRAFT, then ARCHIVED
        results.sort((a, b) => {
          const statusOrder = { ACTIVE: 0, DRAFT: 1, ARCHIVED: 2 };
          return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        });

        // If no barcode matches, search by product title (include all statuses: active, draft, archived)
        if (results.length === 0) {
          const titleData = await shopifyGraphQL(env, `
            query($q:String!) {
              products(first: 10, query: $q) {
                edges {
                  node {
                    id
                    title
                    vendor
                    status
                    featuredImage {
                      url(transform: { maxWidth: 100 })
                    }
                    variants(first: 10) {
                      edges {
                        node {
                          legacyResourceId
                          barcode
                          sku
                          displayName
                          price
                          inventoryQuantity
                        }
                      }
                    }
                  }
                }
              }
            }
          `, { q: `(title:*${searchQuery}*) AND (status:ACTIVE OR status:DRAFT OR status:ARCHIVED)` });

          // Return grouped products with variants
          results = (titleData?.products?.edges || []).map(edge => ({
            type: 'product', // Mark as grouped product
            productTitle: edge.node.title,
            vendor: edge.node.vendor || "",
            status: edge.node.status,
            image: edge.node.featuredImage?.url || null,
            variants: (edge.node.variants.edges || []).map(variantEdge => ({
              variantId: variantEdge.node.legacyResourceId,
              variantTitle: variantEdge.node.displayName || "Default Title",
              price: variantEdge.node.price,
              sku: variantEdge.node.sku || "",
              barcode: variantEdge.node.barcode || "",
              inventoryQuantity: variantEdge.node.inventoryQuantity || 0
            }))
          }));

          // Sort title search results: ACTIVE first, then DRAFT, then ARCHIVED
          results.sort((a, b) => {
            const statusOrder = { ACTIVE: 0, DRAFT: 1, ARCHIVED: 2 };
            return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
          });

          // Limit to 10 products
          results = results.slice(0, 10);
        }

        return json({ products: results }, 200);
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // === IMPROVED: ORDER REQUEST SUBMISSION ===
    if (url.pathname === "/order-request" && request.method === "POST") {
      try {
        const body = await request.json();

        // Require at least email or phone (email preferred)
        const email = (body?.customer?.email || "").trim();
        const phone = (body?.customer?.phone || "").trim();
        if (!email && !phone) return json({ ok: false, error: "Provide email (preferred) or phone." }, 400);

        // 1) Attach/create customer (email preferred; phone attach-only)
        const customer = await findOrAttachCustomer(body.customer, env);

        // 1b) Update customer phone if provided and customer exists
        if (customer && customer.id && phone && phone !== customer.phone) {
          try {
            await shopifyRest(env, `/customers/${customer.id}.json`, "PUT", {
              customer: {
                id: customer.id,
                phone: phone
              }
            });
          } catch (e) {
            console.error("Failed to update customer phone:", e);
            // Continue anyway - phone update failure shouldn't block order creation
          }
        }

        // 2) Build line items
        const lineItems = [];
        for (const item of body.items || []) {
          // FIXED: Handle variant IDs properly
          if (item.variantId) {
            const vid = parseVariantId(item.variantId);
            if (vid) {
              lineItems.push({
                variant_id: Number(vid),
                quantity: Number(item.quantity || 1)
              });
              continue;
            }
          }

          // Fallback to barcode lookup
          if (item.barcode) {
            const vid = await variantIdFromBarcode(item.barcode, env);
            if (vid) {
              lineItems.push({
                variant_id: Number(vid),
                quantity: Number(item.quantity || 1)
              });
              continue;
            }
          }

          // Custom line item
          if (item.customTitle && item.customPrice) {
            const price = normalizeMoney(item.customPrice);
            if (!price) throw new Error(`Custom price is invalid for "${item.customTitle || 'Untitled'}".`);
            lineItems.push({
              title: String(item.customTitle).slice(0, 255),
              price,
              quantity: Number(item.quantity || 1),
              taxable: true
            });
            continue;
          }

          throw new Error("Each item needs Variant ID/Barcode OR Custom Title + Price.");
        }

        if (!lineItems.length) return json({ ok: false, error: "No items." }, 400);

        // 3) Create Draft Order
        const draftPayload = {
          draft_order: {
            customer: customer?.id ? { id: customer.id } : undefined,
            tags: `order-request,pending${customer ? "" : ",no-email"}`,
            note: body.notes ? String(body.notes) : "",
            note_attributes: [
              { name: "Request Source", value: "In-store order form" },
              ...(body.internalRef ? [{ name: "Internal Ref", value: String(body.internalRef) }] : []),
              ...(email ? [{ name: "Customer Email", value: email }] : []),
              ...(phone ? [{ name: "Customer Phone", value: phone }] : []),
            ],
            line_items: lineItems
          }
        };

        const created = await shopifyRest(env, "/draft_orders.json", "POST", draftPayload);
        const draft = created?.draft_order;
        const adminUrl = draft?.id ? `https://${env.SHOPIFY_STORE}/admin/draft_orders/${draft.id}` : null;

        // 4) Notifications (same as before)
        const customerEmail = customer?.email || (email || null);
        const notifyCustomer = body.notifyCustomer !== false;

        if (env.RESEND_API_KEY && env.FROM_EMAIL && customerEmail && notifyCustomer) {
          // Build item list for customer email with variant details
          const itemList = (draft?.line_items || []).map(li => {
            const title = li.title || li.name || 'Product';
            const variant = li.variant_title || li.variantTitle;
            const qty = li.quantity || 1;

            // Show variant if it exists and isn't "Default Title"
            if (variant && variant !== 'Default Title') {
              return `<li><strong>${title}</strong> - ${variant} (Qty: ${qty})</li>`;
            } else {
              return `<li><strong>${title}</strong> (Qty: ${qty})</li>`;
            }
          }).join('');

          await sendResend(env, {
            from: env.FROM_EMAIL,
            to: customerEmail,
            reply_to: env.STAFF_EMAIL || undefined,
            subject: "We received your request - Curly's Sports Supplements",
            html: `
              <h2 style="color: #333;">Order Request Received</h2>
              <p>Thanks! Your request has been received and we'll get it ordered in for you.</p>

              <p><strong>Reference Number:</strong> ${draft?.name || draft?.id}</p>

              <h3 style="color: #555; font-size: 16px;">Items Requested:</h3>
              <ul style="list-style-type: none; padding-left: 0;">
                ${itemList}
              </ul>

              <p>We'll email you again when your items are in stock.</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                Questions? Reply to this email or call us at the store.
              </p>
            `
          });
        }

        const notifyAll = String(env.STAFF_NOTIFY_ALL || "false").toLowerCase() === "true";
        if (env.RESEND_API_KEY && env.FROM_EMAIL && env.STAFF_EMAIL && (!customerEmail || notifyAll)) {
          const lineList = (draft?.line_items || lineItems).map(li =>
            li.variant_id ? `Variant #${li.variant_id} × ${li.quantity}` :
            `${li.title} @ ${li.price} × ${li.quantity}`
          ).join("<br/>");

          await sendResend(env, {
            from: env.FROM_EMAIL,
            to: env.STAFF_EMAIL,
            subject: customerEmail
              ? `Order request received (email on file): ${draft?.name || draft?.id}`
              : `Order request — customer has NO email: ${draft?.name || draft?.id}`,
            html: `
              <p><strong>Draft:</strong> <a href="${adminUrl}">${draft?.name || draft?.id}</a></p>
              <p><strong>Email:</strong> ${customerEmail || "(none)"}<br/>
              <strong>Phone:</strong> ${phone || "(none)"}</p>
              <p>${lineList}</p>
            `
          });
        }

        return json({
          ok: true,
          draftOrderId: draft?.id,
          draftOrderName: draft?.name,
          adminUrl
        }, 200);
      } catch (e) {
        console.error("Order request error:", e);
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // === DASHBOARD API ===
    if (url.pathname === "/api/dashboard/orders" && request.method === "GET") {
      try {
        const drafts = await listOpenRequestDrafts(env);
        const orders = drafts
          .filter(d => (d.tags || "").includes("order-request"))
          .filter(d => (d.tags || "").includes("pending"))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(draft => ({
            id: draft.id,
            name: draft.name || `#${draft.id}`,
            customerName: draft.customer ?
              `${draft.customer.first_name || ''} ${draft.customer.last_name || ''}`.trim() :
              'Guest',
            customerEmail: draft.customer?.email || draft.note_attributes?.find(na => na.name === 'Customer Email')?.value,
            customerPhone: draft.customer?.phone || draft.note_attributes?.find(na => na.name === 'Customer Phone')?.value,
            createdAt: draft.created_at,
            status: 'pending',
            items: (draft.line_items || []).map(li => ({
              title: li.title,
              variant: li.variant_title !== 'Default Title' ? li.variant_title : null,
              quantity: li.quantity,
              isCustom: !li.variant_id // Custom items don't have variant_id
            }))
          }));

        return json({ orders }, 200);
      } catch (e) {
        console.error("Dashboard orders error:", e);
        return json({ ok: false, error: e.message }, 500);
      }
    }

    if (url.pathname.match(/^\/api\/dashboard\/orders\/(\d+)\/ready$/) && request.method === "POST") {
      try {
        const match = url.pathname.match(/^\/api\/dashboard\/orders\/(\d+)\/ready$/);
        const draftId = match[1];

        // Update draft to remove 'pending' tag
        const draft = await shopifyRest(env, `/draft_orders/${draftId}.json`, "GET");
        const currentTags = draft.draft_order.tags || "";
        const newTags = currentTags.replace(/,?pending/g, '').replace(/^,|,$/g, '') + ',ready';

        await shopifyRest(env, `/draft_orders/${draftId}.json`, "PUT", {
          draft_order: {
            id: Number(draftId),
            tags: newTags
          }
        });

        return json({ ok: true }, 200);
      } catch (e) {
        console.error("Mark ready error:", e);
        return json({ ok: false, error: e.message }, 500);
      }
    }

    if (url.pathname.match(/^\/api\/dashboard\/orders\/(\d+)\/email$/) && request.method === "POST") {
      try {
        const match = url.pathname.match(/^\/api\/dashboard\/orders\/(\d+)\/email$/);
        const draftId = match[1];
        const body = await request.json();
        const customMessage = body.message;

        const draft = await shopifyRest(env, `/draft_orders/${draftId}.json`, "GET");
        const draftData = draft.draft_order;
        const email = draftData.customer?.email;

        if (!email) {
          return json({ ok: false, error: 'No email on file' }, 400);
        }

        const message = customMessage || 'Your items have arrived and are ready for pickup!';

        await sendResend(env, {
          from: env.FROM_EMAIL,
          to: email,
          reply_to: env.STAFF_EMAIL,
          subject: `Your order is ready - ${draftData.name}`,
          html: `
            <h2 style="color: #333;">Your Items Have Arrived!</h2>
            <p>${message}</p>
            <p><strong>Reference Number:</strong> ${draftData.name}</p>
            <p>You can come pick them up at your convenience or we can send you a payment link.</p>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Questions? Reply to this email or call us at the store.
            </p>
          `
        });

        return json({ ok: true }, 200);
      } catch (e) {
        console.error("Email customer error:", e);
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // === SHOPIFY FLOW: Back in stock (unchanged) ===
    if (url.pathname === "/flow/back-in-stock" && request.method === "POST") {
      if (request.headers.get("x-flow-secret") !== env.FLOW_SHARED_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      const body = await request.json();
      const variantId =
        legacyIdFromGid(body.variant_gid) ||
        (body.barcode ? await variantIdFromBarcode(body.barcode, env) : null);
      if (!variantId) return json({ ok: false, reason: "No variant id" }, 200);

      const drafts = await listOpenRequestDrafts(env);
      const matches = drafts
        .filter(d => (d.tags || "").includes("order-request"))
        .filter(d => (d.tags || "").includes("pending"))
        .filter(d => (d.line_items || []).some(li => Number(li.variant_id) === Number(variantId)))
        .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

      let notified = 0, invoiced = 0;
      const autoInvoice = String(env.AUTO_INVOICE_ON_STOCK || "false").toLowerCase() === "true";

      for (const draft of matches) {
        const alreadyNotified =
          (draft.tags || "").includes("notified") ||
          (draft.note_attributes || []).some(na => na.name === `notified_variant_${variantId}`);
        if (alreadyNotified) continue;

        const email = draft?.customer?.email;
        const productName = (draft.line_items || []).find(li => Number(li.variant_id) === Number(variantId))?.title;

        // Send invoice if AUTO_INVOICE_ON_STOCK is true, otherwise send plain text email
        if (autoInvoice && email) {
          // Send Shopify invoice only (better formatted, allows payment)
          await sendInvoice(env, draft, "You can pay now to reserve it, or come in to buy. Thanks!");
          invoiced++;
          notified++;
        } else if (email && env.RESEND_API_KEY && env.FROM_EMAIL) {
          // Fallback: send plain text email if no auto-invoice or no email
          await sendResend(env, {
            from: env.FROM_EMAIL,
            to: email,
            reply_to: env.STAFF_EMAIL || undefined,
            subject: `Now in stock: ${productName || "Your requested item"}`,
            html: `
              <p>Good news—your requested item is now in stock.</p>
              <p><strong>Reference:</strong> ${draft.name || draft.id}</p>
              <p>You can pay now to reserve it, or visit us in-store.</p>
            `
          });
          notified++;
        }

        if (env.RESEND_API_KEY && env.FROM_EMAIL && env.STAFF_EMAIL) {
          await sendResend(env, {
            from: env.FROM_EMAIL,
            to: env.STAFF_EMAIL,
            subject: `Customer ${email ? "notified" : "has no email"} — ${productName || "Requested item"}`,
            html: `
              <p>Variant #${variantId} back in stock.</p>
              <p><a href="https://${env.SHOPIFY_STORE}/admin/draft_orders/${draft.id}">Open Draft</a></p>
              <p>Please set the item aside.</p>
            `
          });
        }

        await shopifyRest(env, `/draft_orders/${draft.id}.json`, "PUT", {
          draft_order: {
            id: draft.id,
            tags: `${draft.tags || ""},notified`,
            note_attributes: [
              ...(draft.note_attributes || []),
              { name: `notified_variant_${variantId}`, value: new Date().toISOString() }
            ]
          }
        });
      }

      return json({ ok: true, variantId, matches: matches.length, notified, invoiced }, 200);
    }

    return new Response("Not found", { status: 404, headers: cors() });
  }
};

/* ================= helpers ================= */

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,x-flow-secret",
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET"
  };
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors() }
  });
}

function legacyIdFromGid(gid) {
  const m = /\/(\d+)$/.exec(gid || "");
  return m ? Number(m[1]) : null;
}

function parseVariantId(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = /(\d+)$/.exec(s);
  return m ? Number(m[1]) : null;
}

function normalizeMoney(x) {
  if (x == null) return null;
  let s = String(x).trim().replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

async function shopifyRest(env, path, method="GET", body) {
  const res = await fetch(`https://${env.SHOPIFY_STORE}/admin/api/2024-10${path}`, {
    method,
    headers: {
      "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    let detail = await res.text();
    try { detail = JSON.stringify(JSON.parse(detail), null, 2); } catch {}
    throw new Error(`Shopify REST ${method} ${path} failed: ${res.status} ${detail}`);
  }
  return res.json();
}

async function shopifyGraphQL(env, query, variables) {
  const res = await fetch(`https://${env.SHOPIFY_STORE}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) throw new Error(`Shopify GraphQL failed: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function variantIdFromBarcode(barcode, env) {
  const data = await shopifyGraphQL(env, `
    query($q:String!) {
      productVariants(first: 1, query: $q) {
        edges { node { legacyResourceId barcode } }
      }
    }
  `, { q: `barcode:${String(barcode).trim()}` });
  return data?.productVariants?.edges?.[0]?.node?.legacyResourceId || null;
}

async function findOrAttachCustomer(customerInput, env) {
  if (!customerInput) throw new Error("Customer object missing");

  const email = (customerInput.email || "").trim().toLowerCase();
  const phone = (customerInput.phone || "").trim();

  if (email) {
    const found = await shopifyRest(env, `/customers/search.json?query=email:${encodeURIComponent(email)}`);
    if (found?.customers?.length) return found.customers[0];

    const created = await shopifyRest(env, `/customers.json`, "POST", {
      customer: {
        first_name: customerInput.firstName || "",
        last_name: customerInput.lastName || "",
        email,
        phone: phone || undefined,
        tags: "order-request-customer"
      }
    });
    return created?.customer || null;
  }

  if (phone) {
    const foundByPhone = await shopifyRest(env, `/customers/search.json?query=phone:${encodeURIComponent(phone)}`);
    if (foundByPhone?.customers?.length) return foundByPhone.customers[0];
  }

  return null;
}

async function sendInvoice(env, draft, customMessage) {
  await shopifyRest(env, `/draft_orders/${draft.id}/send_invoice.json`, "POST", {
    draft_order_invoice: {
      custom_message: customMessage || "You can pay now to reserve it, or visit us in-store."
    }
  });
}

async function listOpenRequestDrafts(env) {
  const res = await shopifyRest(env, `/draft_orders.json?status=open`);
  return (res?.draft_orders || []).filter(d => (d.tags || "").includes("order-request"));
}

async function sendResend(env, payload) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}
