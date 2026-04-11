const STOCKY_LOOKUP_CACHE = {
  lookup: null,
  expiresAt: 0
};
const STOCKY_CACHE_TTL_MS = 5 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });

    // Health check
    if (url.pathname === "/health") return new Response("OK", { headers: cors() });

    // === IP WHITELIST CHECK ===
    if (url.pathname === "/api/auth/check-ip" && request.method === "GET") {
      const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
      const whitelistedIPs = ["142.177.77.123"]; // Work IP
      const isWhitelisted = whitelistedIPs.includes(clientIP);
      return json({ whitelisted: isWhitelisted, ip: clientIP }, 200);
    }

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
        const STATUS_FILTER = "(status:ACTIVE OR status:DRAFT OR status:ARCHIVED)";
        const PRODUCT_LIMIT = 25;
        const VARIANTS_PER_PRODUCT_LIMIT = 25;
        const VARIANT_TEXT_LIMIT = 100;
        const statusOrder = { ACTIVE: 0, DRAFT: 1, ARCHIVED: 2 };

        // Try barcode search first if query looks like a barcode (numbers/alphanumeric)
        let results = [];

        // Search by barcode using GraphQL (include all statuses: active, draft, archived)
        const barcodeData = await shopifyGraphQL(env, `
          query($q:String!) {
            productVariants(first: ${PRODUCT_LIMIT}, query: $q) {
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
        `, { q: `(barcode:${searchQuery}) AND ${STATUS_FILTER}` });

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
        results.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));

        // If no barcode matches, search variants by text so variant-only terms are discoverable
        if (results.length === 0) {
          const variantData = await shopifyGraphQL(env, `
            query($q:String!) {
              productVariants(first: ${VARIANT_TEXT_LIMIT}, query: $q) {
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
          `, { q: `${searchQuery} AND ${STATUS_FILTER}` });

          const groupedResults = new Map();
          (variantData?.productVariants?.edges || []).forEach(edge => {
            const product = edge.node.product;
            if (!product || !product.id) return;

            if (!groupedResults.has(product.id)) {
              groupedResults.set(product.id, {
                type: 'product',
                productTitle: product.title,
                vendor: product.vendor || "",
                status: product.status,
                image: product.featuredImage?.url || null,
                variants: []
              });
            }

            const groupedProduct = groupedResults.get(product.id);
            if (groupedProduct.variants.length >= VARIANTS_PER_PRODUCT_LIMIT) return;

            groupedProduct.variants.push({
              variantId: edge.node.legacyResourceId,
              variantTitle: edge.node.displayName || "Default Title",
              price: edge.node.price,
              sku: edge.node.sku || "",
              barcode: edge.node.barcode || "",
              inventoryQuantity: edge.node.inventoryQuantity || 0
            });
          });

          results = Array.from(groupedResults.values());

          results.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));
          results = results.slice(0, PRODUCT_LIMIT);
        }

        // Fallback: search by product title and include more variants per product
        if (results.length === 0) {
          const titleData = await shopifyGraphQL(env, `
            query($q:String!) {
              products(first: ${PRODUCT_LIMIT}, query: $q) {
                edges {
                  node {
                    id
                    title
                    vendor
                    status
                    featuredImage {
                      url(transform: { maxWidth: 100 })
                    }
                    variants(first: ${VARIANTS_PER_PRODUCT_LIMIT}) {
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
          `, { q: `(title:*${searchQuery}*) AND ${STATUS_FILTER}` });

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
          results.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));

          // Limit to 25 products
          results = results.slice(0, PRODUCT_LIMIT);
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
        const emailLineItems = await enrichLineItemsForEmail(draft?.line_items || lineItems, env);

        // 4) Notifications (same as before)
        const customerEmail = customer?.email || (email || null);
        const notifyCustomer = body.notifyCustomer !== false;

        if (env.RESEND_API_KEY && env.FROM_EMAIL && customerEmail && notifyCustomer) {
          const itemList = buildLineItemListHtml(emailLineItems, {
            includePrice: true,
            includeSku: false,
            includeVariantId: false,
            includeVendor: true
          });

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
              <ul style="padding-left: 20px;">
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
          const staffItems = buildLineItemListHtml(emailLineItems, {
            includePrice: true,
            includeSku: true,
            includeVariantId: true,
            includeVendor: true
          });

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
              <h3 style="margin-bottom: 8px;">Items:</h3>
              <ul style="padding-left: 20px; margin: 0;">
                ${staffItems}
              </ul>
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
        const dashboardVariantIds = collectVariantIdsFromDrafts(drafts);
        const dashboardVariantDetails = await fetchVariantDetailsMap(env, dashboardVariantIds);
        const stockyLookup = await buildStockyPurchaseLookup(env);
        const orders = drafts
          .filter(d => (d.tags || "").includes("order-request"))
          .filter(d => {
            const tags = d.tags || "";
            // Include orders that are either pending OR ready
            return tags.includes("pending") || tags.includes("ready");
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(draft => {
            const tags = draft.tags || "";
            const status = tags.includes("ready") ? "ready" : "pending";
            const reminder = getReminderState(draft);
            const urgency = status === "pending"
              ? (reminder.ageDays >= 14 ? "critical" : reminder.ageDays >= 7 ? "warning" : "normal")
              : "none";
            const lineItems = enrichLineItemsFromMap(draft.line_items || [], dashboardVariantDetails);

            // Extract note if available
            const note = draft.note_attributes?.find(na => na.name === 'Note')?.value || draft.note;
            const reminderMutedReason = getNoteAttribute(draft.note_attributes, "reminder_muted_reason");

            return {
              id: draft.id,
              name: draft.name || `#${draft.id}`,
              customerName: draft.customer ?
                `${draft.customer.first_name || ''} ${draft.customer.last_name || ''}`.trim() :
                'Guest',
              customerEmail: draft.customer?.email || draft.note_attributes?.find(na => na.name === 'Customer Email')?.value,
              customerPhone: draft.customer?.phone || draft.note_attributes?.find(na => na.name === 'Customer Phone')?.value,
              createdAt: draft.created_at,
              ageDays: reminder.ageDays,
              urgency,
              status: status,
              reminderMuted: reminder.muted,
              reminderSnoozedUntil: reminder.snoozedUntil ? reminder.snoozedUntil.toISOString() : null,
              reminderSuppressed: reminder.muted || reminder.snoozed,
              reminderMutedReason: reminderMutedReason || null,
              note: note,
              items: lineItems.map(li => {
                const stockyMatch = getStockyMatchForLineItem(li, stockyLookup);
                const vendor = String(li.vendor || "").trim() || null;
                const supplierName = stockyMatch?.supplierName || vendor;
                const supplierSource = stockyMatch?.supplierName
                  ? "stocky"
                  : vendor
                    ? "vendor"
                    : "unknown";

                return {
                  title: lineItemTitle(li),
                  variant: normalizeVariantTitle(li.variant_title || li.variantTitle),
                  quantity: safeQuantity(li),
                  sku: String(li.sku || "").trim() || null,
                  vendor,
                  inventoryItemId: parseVariantId(li.inventory_item_id) || null,
                  supplierName: supplierName || null,
                  supplierSource,
                  stockyOrdered: !!stockyMatch,
                  stockyPurchaseOrderId: stockyMatch?.purchaseOrderId || null,
                  stockyPurchaseOrderNumber: stockyMatch?.purchaseOrderNumber || null,
                  stockyPurchaseItemStatus: stockyMatch?.purchaseItemStatus || null,
                  stockyExpectedOn: stockyMatch?.expectedOn || null,
                  stockyOrderedAt: stockyMatch?.orderedAt || null,
                  stockyItemQuantity: Number(stockyMatch?.quantity) || null,
                  isCustom: isCustomLineItem(li)
                };
              })
            };
          });

        return json({ orders }, 200);
      } catch (e) {
        console.error("Dashboard orders error:", e);
        return json({ ok: false, error: e.message }, 500);
      }
    }

    if (url.pathname === "/api/dashboard/supplier-queue" && request.method === "GET") {
      try {
        const drafts = await listOpenRequestDrafts(env);
        const pendingDrafts = drafts.filter(d => parseTags(d.tags).includes("pending"));
        const variantIds = collectVariantIdsFromDrafts(pendingDrafts);
        const variantDetails = await fetchVariantDetailsMap(env, variantIds);
        const stockyLookup = await buildStockyPurchaseLookup(env);

        const suppliersMap = new Map();

        for (const draft of pendingDrafts) {
          const customerName = draft.customer
            ? `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim() || "Guest"
            : "Guest";
          const draftName = draft.name || `#${draft.id}`;
          const lineItems = enrichLineItemsFromMap(draft.line_items || [], variantDetails);

          for (const li of lineItems) {
            const qty = safeQuantity(li);
            const title = lineItemTitle(li);
            const variant = normalizeVariantTitle(li.variant_title || li.variantTitle);
            const sku = String(li.sku || "").trim() || null;
            const vendor = String(li.vendor || "").trim() || null;
            const inventoryItemId = parseVariantId(li.inventory_item_id) || null;
            const stockyMatch = getStockyMatchForLineItem(li, stockyLookup);
            const supplierName = stockyMatch?.supplierName || vendor || "Direct / Unassigned";
            const supplierId = stockyMatch?.supplierId || null;
            const supplierKey = supplierId ? `id:${supplierId}` : `name:${normalizeSupplierName(supplierName)}`;

            if (!suppliersMap.has(supplierKey)) {
              suppliersMap.set(supplierKey, {
                supplierName,
                supplierId,
                itemMap: new Map(),
                draftIds: new Set(),
                totalRequestedQty: 0
              });
            }

            const supplierBucket = suppliersMap.get(supplierKey);
            supplierBucket.draftIds.add(draft.id);
            supplierBucket.totalRequestedQty += qty;

            const itemKey = inventoryItemId
              ? `inv:${inventoryItemId}`
              : sku
                ? `sku:${normalizeSkuValue(sku)}`
                : `custom:${title}|${variant || ""}`;

            if (!supplierBucket.itemMap.has(itemKey)) {
              supplierBucket.itemMap.set(itemKey, {
                title,
                variant: variant || null,
                sku,
                vendor,
                inventoryItemId,
                requestedQty: 0,
                requestCount: 0,
                draftNames: new Set(),
                customers: new Set(),
                stockyOrdered: !!stockyMatch,
                stockyPurchaseOrderNumber: stockyMatch?.purchaseOrderNumber || null,
                stockyPurchaseItemStatus: stockyMatch?.purchaseItemStatus || null,
                stockyExpectedOn: stockyMatch?.expectedOn || null
              });
            }

            const itemBucket = supplierBucket.itemMap.get(itemKey);
            itemBucket.requestedQty += qty;
            itemBucket.requestCount += 1;
            itemBucket.draftNames.add(draftName);
            itemBucket.customers.add(customerName);

            // Keep the most actionable Stocky PO info if any line has one.
            if (!itemBucket.stockyOrdered && stockyMatch) {
              itemBucket.stockyOrdered = true;
              itemBucket.stockyPurchaseOrderNumber = stockyMatch.purchaseOrderNumber || null;
              itemBucket.stockyPurchaseItemStatus = stockyMatch.purchaseItemStatus || null;
              itemBucket.stockyExpectedOn = stockyMatch.expectedOn || null;
            }
          }
        }

        const suppliers = Array.from(suppliersMap.values())
          .map(bucket => ({
            supplierName: bucket.supplierName,
            supplierId: bucket.supplierId,
            totalRequestedQty: bucket.totalRequestedQty,
            draftCount: bucket.draftIds.size,
            itemCount: bucket.itemMap.size,
            items: Array.from(bucket.itemMap.values())
              .map(item => ({
                title: item.title,
                variant: item.variant,
                sku: item.sku,
                vendor: item.vendor,
                inventoryItemId: item.inventoryItemId,
                requestedQty: item.requestedQty,
                requestCount: item.requestCount,
                draftNames: Array.from(item.draftNames),
                customers: Array.from(item.customers),
                stockyOrdered: item.stockyOrdered,
                stockyPurchaseOrderNumber: item.stockyPurchaseOrderNumber,
                stockyPurchaseItemStatus: item.stockyPurchaseItemStatus,
                stockyExpectedOn: item.stockyExpectedOn
              }))
              .sort((a, b) => b.requestedQty - a.requestedQty)
          }))
          .sort((a, b) => b.totalRequestedQty - a.totalRequestedQty);

        return json({
          ok: true,
          generatedAt: new Date().toISOString(),
          pendingDraftCount: pendingDrafts.length,
          supplierCount: suppliers.length,
          suppliers
        }, 200);
      } catch (e) {
        console.error("Supplier queue error:", e);
        return json({ ok: false, error: e.message }, 500);
      }
    }

    if (url.pathname.match(/^\/api\/dashboard\/orders\/(\d+)\/reminder$/) && request.method === "POST") {
      try {
        const match = url.pathname.match(/^\/api\/dashboard\/orders\/(\d+)\/reminder$/);
        const draftId = match[1];
        const body = await request.json().catch(() => ({}));
        const action = String(body?.action || "").trim().toLowerCase();

        const draftRes = await shopifyRest(env, `/draft_orders/${draftId}.json`, "GET");
        const draft = draftRes?.draft_order;
        if (!draft) return json({ ok: false, error: "Draft not found" }, 404);

        let tags = parseTags(draft.tags);
        let noteAttributes = Array.isArray(draft.note_attributes) ? [...draft.note_attributes] : [];

        if (action === "mute") {
          const reason = String(body?.reason || "").trim();
          tags = ensureTag(tags, "reminder-muted");
          noteAttributes = upsertNoteAttribute(noteAttributes, "reminder_muted_at", new Date().toISOString());
          if (reason) {
            noteAttributes = upsertNoteAttribute(noteAttributes, "reminder_muted_reason", reason.slice(0, 255));
          }
        } else if (action === "unmute") {
          tags = removeTag(tags, "reminder-muted");
          noteAttributes = removeNoteAttribute(noteAttributes, "reminder_muted_at");
          noteAttributes = removeNoteAttribute(noteAttributes, "reminder_muted_reason");
        } else if (action === "snooze") {
          const days = clampNumber(Number(body?.days), 1, 365, 14);
          const snoozeUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          noteAttributes = upsertNoteAttribute(noteAttributes, "reminder_snooze_until", snoozeUntil);
        } else if (action === "clear_snooze") {
          noteAttributes = removeNoteAttribute(noteAttributes, "reminder_snooze_until");
        } else {
          return json({ ok: false, error: "Invalid action" }, 400);
        }

        await shopifyRest(env, `/draft_orders/${draftId}.json`, "PUT", {
          draft_order: {
            id: Number(draftId),
            tags: tags.join(","),
            note_attributes: noteAttributes
          }
        });

        const reminder = getReminderState({
          ...draft,
          tags: tags.join(","),
          note_attributes: noteAttributes
        });

        return json({
          ok: true,
          reminderMuted: reminder.muted,
          reminderSnoozedUntil: reminder.snoozedUntil ? reminder.snoozedUntil.toISOString() : null,
          reminderSuppressed: reminder.muted || reminder.snoozed
        }, 200);
      } catch (e) {
        console.error("Reminder update error:", e);
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

    if (url.pathname.match(/^\/api\/dashboard\/orders\/(\d+)\/complete$/) && request.method === "POST") {
      try {
        const match = url.pathname.match(/^\/api\/dashboard\/orders\/(\d+)\/complete$/);
        const draftId = match[1];
        const draftIdNumber = Number(draftId);
        let draftName = `#${draftId}`;

        try {
          const draftRes = await shopifyRest(env, `/draft_orders/${draftId}.json`, "GET");
          const draft = draftRes?.draft_order;
          if (draft?.name) draftName = draft.name;
        } catch (lookupErr) {
          const message = String(lookupErr?.message || "");
          if (message.includes("404")) {
            return json({
              ok: true,
              alreadyDeleted: true,
              deletedDraftId: Number.isFinite(draftIdNumber) ? draftIdNumber : draftId
            }, 200);
          }
          throw lookupErr;
        }

        try {
          await deleteDraftOrderHard(env, draftId);
        } catch (deleteErr) {
          const message = String(deleteErr?.message || "");
          if (message.includes("404")) {
            return json({
              ok: true,
              alreadyDeleted: true,
              deletedDraftId: Number.isFinite(draftIdNumber) ? draftIdNumber : draftId,
              draftName
            }, 200);
          }
          throw deleteErr;
        }

        return json({
          ok: true,
          deletedDraftId: Number.isFinite(draftIdNumber) ? draftIdNumber : draftId,
          draftName
        }, 200);
      } catch (e) {
        console.error("Complete order error:", e);
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
        const enrichedLineItems = await enrichLineItemsForEmail(draftData.line_items || [], env);
        const itemList = buildLineItemListHtml(enrichedLineItems, {
          includePrice: false,
          includeSku: true,
          includeVariantId: false,
          includeVendor: true
        });

        await sendResend(env, {
          from: env.FROM_EMAIL,
          to: email,
          reply_to: env.STAFF_EMAIL,
          subject: `Your order is ready - ${draftData.name}`,
          html: `
            <h2 style="color: #333;">Your Items Have Arrived!</h2>
            <p>${message}</p>
            <p><strong>Reference Number:</strong> ${draftData.name}</p>
            <h3 style="margin-bottom: 8px;">Items:</h3>
            <ul style="padding-left: 20px; margin-top: 0;">
              ${itemList}
            </ul>
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

    if (url.pathname === "/api/dashboard/reconcile-purchases" && request.method === "POST") {
      try {
        const result = await reconcilePendingRequestsWithOrders(env, {
          source: "manual"
        });
        return json({ ok: true, ...result }, 200);
      } catch (e) {
        console.error("Reconcile purchases error:", e);
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
      const matchedVariantDetails = await fetchVariantDetailsMap(env, [variantId]);

      let notified = 0, invoiced = 0;
      const autoInvoice = String(env.AUTO_INVOICE_ON_STOCK || "false").toLowerCase() === "true";

      for (const draft of matches) {
        const alreadyNotified =
          (draft.tags || "").includes("notified") ||
          (draft.note_attributes || []).some(na => na.name === `notified_variant_${variantId}`);
        if (alreadyNotified) continue;

        const email = draft?.customer?.email;
        const matchedLineItem = (draft.line_items || []).find(li => Number(li.variant_id) === Number(variantId));
        const enrichedMatchedLineItem = enrichLineItemsFromMap(
          [matchedLineItem || { variant_id: variantId }],
          matchedVariantDetails
        )[0];
        const productName = enrichedMatchedLineItem?.title;
        const matchedItemSummary = summarizeLineItems(
          [enrichedMatchedLineItem],
          { maxItems: 1, includeVendor: true }
        );

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
              <p><strong>Item:</strong> ${escapeHtmlText(matchedItemSummary)}</p>
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
              <p><strong>Item:</strong> ${escapeHtmlText(matchedItemSummary)}</p>
              <p><strong>Customer Email:</strong> ${email || "(none)"}</p>
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
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const reconcileResult = await reconcilePendingRequestsWithOrders(env, {
          source: "scheduled"
        });
        console.log("Scheduled purchase reconciliation:", JSON.stringify({
          scanned: reconcileResult.scannedDrafts,
          matched: reconcileResult.matchedDrafts,
          deleted: reconcileResult.deletedDrafts,
          errors: reconcileResult.errorCount
        }));

        if (reconcileResult.deletedDrafts > 0) {
          await sendReconcileSummary(env, reconcileResult, "Scheduled");
        }
      } catch (e) {
        console.error("Scheduled reconciliation failed:", e);
      }

      try {
        await sendPendingReminderDigest(env);
      } catch (e) {
        console.error("Reminder digest failed:", e);
      }
    })());
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

function normalizeVariantTitle(variantTitle) {
  const variant = String(variantTitle || "").trim();
  if (!variant || variant === "Default Title") return null;
  return variant;
}

function safeQuantity(lineItem) {
  const qty = Number(lineItem?.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function lineItemTitle(lineItem) {
  const title = String(lineItem?.title || lineItem?.name || "").trim();
  if (title) return title;
  const variantId = lineItem?.variant_id || lineItem?.variantId;
  if (variantId) return `Variant #${variantId}`;
  return "Item";
}

function parsePrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCurrency(value) {
  const n = parsePrice(value);
  return n == null ? null : `$${n.toFixed(2)}`;
}

function lineItemMeta(lineItem, options = {}) {
  const {
    includePrice = true,
    includeSku = true,
    includeVariantId = false,
    includeVendor = false
  } = options;

  const parts = [];
  const variant = normalizeVariantTitle(lineItem?.variant_title || lineItem?.variantTitle);
  const qty = safeQuantity(lineItem);
  const sku = String(lineItem?.sku || "").trim();
  const vendor = String(lineItem?.vendor || "").trim();
  const variantId = lineItem?.variant_id || lineItem?.variantId;

  if (variant) parts.push(variant);
  if (includeSku && sku) parts.push(`SKU: ${sku}`);
  if (includeVendor && vendor) parts.push(`Vendor: ${vendor}`);

  const unitPrice = parsePrice(lineItem?.price);
  if (includePrice && unitPrice != null) {
    parts.push(`${formatCurrency(unitPrice)} each`);
    parts.push(`Line total: ${formatCurrency(unitPrice * qty)}`);
  }

  if (includeVariantId && variantId) {
    parts.push(`Variant ID: ${variantId}`);
  }

  return parts;
}

function isCustomLineItem(lineItem) {
  return !(lineItem?.variant_id || lineItem?.variantId);
}

function getLineItemVariantId(lineItem) {
  const variantId = parseVariantId(lineItem?.variant_id || lineItem?.variantId);
  return variantId || null;
}

function collectVariantIdsFromLineItems(lineItems) {
  return Array.from(new Set(
    (Array.isArray(lineItems) ? lineItems : [])
      .map(getLineItemVariantId)
      .filter(Boolean)
  ));
}

function collectVariantIdsFromDrafts(drafts) {
  return Array.from(new Set(
    (Array.isArray(drafts) ? drafts : [])
      .flatMap(draft => collectVariantIdsFromLineItems(draft?.line_items || []))
      .filter(Boolean)
  ));
}

function enrichLineItemsFromMap(lineItems, detailsMap) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  if (!(detailsMap instanceof Map) || !detailsMap.size) return items;

  return items.map(lineItem => {
    const variantId = getLineItemVariantId(lineItem);
    if (!variantId) return lineItem;

    const details = detailsMap.get(String(variantId));
    if (!details) return lineItem;

    const enriched = { ...lineItem };
    if (!enriched.vendor && details.vendor) enriched.vendor = details.vendor;
    if (!enriched.sku && details.sku) enriched.sku = details.sku;
    if (!normalizeVariantTitle(enriched.variant_title || enriched.variantTitle) && details.variantTitle) {
      enriched.variant_title = details.variantTitle;
    }
    if (!enriched.title && details.productTitle) enriched.title = details.productTitle;
    if (!enriched.inventory_item_id && details.inventoryItemId) {
      enriched.inventory_item_id = details.inventoryItemId;
    }
    return enriched;
  });
}

function buildLineItemListHtml(lineItems, options = {}) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  if (!items.length) return `<li>${escapeHtmlText("No items listed")}</li>`;

  return items.map(lineItem => {
    const title = lineItemTitle(lineItem);
    const qty = safeQuantity(lineItem);
    const meta = lineItemMeta(lineItem, options);
    const metaText = meta.length ? escapeHtmlText(meta.join(" • ")) : "";
    const customBadge = isCustomLineItem(lineItem)
      ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#FFF1DF;color:#9C4221;border-radius:999px;font-size:11px;font-weight:700;">CUSTOM</span>`
      : "";

    return `
      <li style="margin-bottom: 10px;">
        <div><strong>${escapeHtmlText(title)}</strong>${customBadge} × ${qty}</div>
        ${metaText ? `<div style="font-size: 13px; color: #666;">${metaText}</div>` : ""}
      </li>
    `;
  }).join("");
}

function summarizeLineItems(lineItems, options = {}) {
  const maxItems = clampNumber(Number(options?.maxItems), 1, 20, 3);
  const includeVendor = options?.includeVendor !== false;
  const items = Array.isArray(lineItems) ? lineItems.filter(Boolean) : [];
  if (!items.length) return "No items listed";

  const summaries = items.slice(0, maxItems).map(lineItem => {
    const title = lineItemTitle(lineItem);
    const qty = safeQuantity(lineItem);
    const variant = normalizeVariantTitle(lineItem?.variant_title || lineItem?.variantTitle);
    const sku = String(lineItem?.sku || "").trim();
    const vendor = String(lineItem?.vendor || "").trim();

    const parts = [`${qty}x ${title}`];
    if (variant) parts.push(variant);
    if (sku) parts.push(`SKU ${sku}`);
    if (includeVendor && vendor) parts.push(`Vendor ${vendor}`);
    return parts.join(" • ");
  });

  const extra = items.length - summaries.length;
  if (extra > 0) summaries.push(`+${extra} more`);
  return summaries.join(" | ");
}

function parseTags(tags) {
  if (!tags) return [];
  return Array.from(new Set(
    String(tags)
      .split(",")
      .map(t => t.trim())
      .filter(Boolean)
  ));
}

function ensureTag(tags, tag) {
  return tags.includes(tag) ? tags : [...tags, tag];
}

function removeTag(tags, tag) {
  return tags.filter(t => t !== tag);
}

function getNoteAttribute(noteAttributes, name) {
  if (!Array.isArray(noteAttributes)) return null;
  const found = noteAttributes.find(na => na?.name === name);
  return found?.value ?? null;
}

function upsertNoteAttribute(noteAttributes, name, value) {
  const next = (noteAttributes || []).filter(na => na?.name !== name);
  next.push({ name, value: String(value) });
  return next;
}

function removeNoteAttribute(noteAttributes, name) {
  return (noteAttributes || []).filter(na => na?.name !== name);
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function escapeHtmlText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getReminderState(draft, now = new Date()) {
  const tags = parseTags(draft?.tags);
  const muted = tags.includes("reminder-muted");

  const snoozeValue = getNoteAttribute(draft?.note_attributes, "reminder_snooze_until");
  const snoozeUntil = snoozeValue ? new Date(snoozeValue) : null;
  const hasValidSnooze = !!(snoozeUntil && !Number.isNaN(snoozeUntil.getTime()));
  const snoozed = hasValidSnooze ? snoozeUntil > now : false;

  const createdAt = new Date(draft?.created_at || now.toISOString());
  const msAge = Math.max(0, now.getTime() - createdAt.getTime());
  const ageDays = Math.floor(msAge / (24 * 60 * 60 * 1000));

  return {
    muted,
    snoozed,
    snoozeUntil: hasValidSnooze ? snoozeUntil : null,
    ageDays
  };
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

async function deleteDraftOrderHard(env, draftId) {
  const response = await fetch(`https://${env.SHOPIFY_STORE}/admin/api/2024-10/draft_orders/${draftId}.json`, {
    method: "DELETE",
    headers: {
      "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    let detail = await response.text();
    try { detail = JSON.stringify(JSON.parse(detail), null, 2); } catch {}
    throw new Error(`Shopify REST DELETE /draft_orders/${draftId}.json failed: ${response.status} ${detail}`);
  }
}

function stockyEnabled(env) {
  return !!String(env?.STOCKY_API_KEY || "").trim();
}

function normalizeSkuValue(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeSupplierName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toStockyDate(value) {
  const date = value instanceof Date ? value : new Date(value || "");
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function stockyRequest(env, path, query = {}) {
  if (!stockyEnabled(env)) return null;

  const requestUrl = new URL(`https://stocky.shopifyapps.com/api/v2${path}`);
  for (const [key, val] of Object.entries(query || {})) {
    if (val === undefined || val === null || val === "") continue;
    requestUrl.searchParams.set(key, String(val));
  }

  const response = await fetch(requestUrl.toString(), {
    method: "GET",
    headers: {
      "Store-Name": env.SHOPIFY_STORE,
      "Authorization": `API KEY=${env.STOCKY_API_KEY}`
    }
  });

  if (!response.ok) {
    let detail = await response.text();
    try { detail = JSON.stringify(JSON.parse(detail), null, 2); } catch {}
    throw new Error(`Stocky GET ${path} failed: ${response.status} ${detail}`);
  }

  return response.json();
}

async function listStockySuppliers(env, options = {}) {
  if (!stockyEnabled(env)) return [];

  const perPage = clampNumber(Number(options?.limit), 1, 250, 250);
  const maxPages = clampNumber(Number(options?.maxPages), 1, 20, 5);
  const suppliers = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const data = await stockyRequest(env, "/suppliers.json", {
      limit: perPage,
      offset
    });
    const rows = Array.isArray(data?.suppliers) ? data.suppliers : [];
    suppliers.push(...rows);
    if (rows.length < perPage) break;
    offset += perPage;
  }

  return suppliers;
}

async function listStockyPurchaseOrders(env, options = {}) {
  if (!stockyEnabled(env)) return [];

  const status = String(options?.status || "open-unarchived").trim();
  const perPage = clampNumber(Number(options?.limit), 1, 250, 100);
  const maxPages = clampNumber(Number(options?.maxPages), 1, 50, 10);
  const updatedAtMin = toStockyDate(options?.updatedAtMin);
  const purchaseOrders = [];
  let sinceId = null;

  for (let page = 0; page < maxPages; page++) {
    const data = await stockyRequest(env, "/purchase_orders.json", {
      status,
      limit: perPage,
      since_id: sinceId,
      updated_at_min: updatedAtMin
    });

    const rows = Array.isArray(data?.purchase_orders) ? data.purchase_orders : [];
    purchaseOrders.push(...rows);
    if (rows.length < perPage) break;

    const ids = rows
      .map(row => Number(row?.id))
      .filter(id => Number.isFinite(id) && id > 0);
    if (!ids.length) break;
    sinceId = Math.min(...ids);
  }

  return purchaseOrders;
}

function createStockyLookup() {
  return {
    suppliersById: new Map(),
    byInventoryItemId: new Map(),
    bySku: new Map()
  };
}

function pushStockyLookupEntry(map, key, entry) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(entry);
}

function pickBestStockyEntry(entries) {
  const items = Array.isArray(entries) ? [...entries] : [];
  if (!items.length) return null;

  const priority = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "not delivered") return 3;
    if (normalized === "delivered") return 2;
    return 1;
  };

  items.sort((a, b) => {
    const pr = priority(b.purchaseItemStatus) - priority(a.purchaseItemStatus);
    if (pr !== 0) return pr;

    const aDate = parseDateOrNull(a.updatedAt || a.orderedAt || a.createdAt)?.getTime() || 0;
    const bDate = parseDateOrNull(b.updatedAt || b.orderedAt || b.createdAt)?.getTime() || 0;
    return bDate - aDate;
  });

  return items[0] || null;
}

async function buildStockyPurchaseLookup(env) {
  if (!stockyEnabled(env)) return createStockyLookup();
  if (Date.now() < STOCKY_LOOKUP_CACHE.expiresAt && STOCKY_LOOKUP_CACHE.lookup) {
    return STOCKY_LOOKUP_CACHE.lookup;
  }

  const lookup = createStockyLookup();
  try {
    const lookbackDays = clampNumber(Number(env.STOCKY_PO_LOOKBACK_DAYS), 1, 365, 90);
    const stockySinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const statuses = String(env.STOCKY_PO_STATUSES || "open-unarchived,confirmed-unarchived")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    const poLimit = clampNumber(Number(env.STOCKY_PO_LIMIT), 1, 250, 60);
    const poMaxPages = clampNumber(Number(env.STOCKY_PO_MAX_PAGES), 1, 50, 3);

    const suppliers = await listStockySuppliers(env, { limit: 250, maxPages: 4 });
    for (const supplier of suppliers) {
      const supplierId = Number(supplier?.id);
      if (!Number.isFinite(supplierId) || supplierId <= 0) continue;
      lookup.suppliersById.set(supplierId, supplier);
    }

    const purchaseOrdersById = new Map();
    for (const status of statuses) {
      const rows = await listStockyPurchaseOrders(env, {
        status,
        limit: poLimit,
        maxPages: poMaxPages,
        updatedAtMin: stockySinceDate
      });
      for (const row of rows) {
        const poId = Number(row?.id);
        if (!Number.isFinite(poId) || poId <= 0) continue;
        if (!purchaseOrdersById.has(poId)) purchaseOrdersById.set(poId, row);
      }
    }

    for (const po of purchaseOrdersById.values()) {
      const supplierId = Number(po?.supplier_id);
      const supplier = Number.isFinite(supplierId) && supplierId > 0
        ? lookup.suppliersById.get(supplierId)
        : null;
      const supplierName = po?.supplier_name || supplier?.name || null;
      const poNumber = po?.number || po?.sequential_id || null;
      const poItems = Array.isArray(po?.purchase_items) ? po.purchase_items : [];

      for (const item of poItems) {
        const inventoryItemId = parseVariantId(item?.inventory_item_id);
        const sku = normalizeSkuValue(item?.sku);
        const entry = {
          purchaseOrderId: Number(po?.id) || null,
          purchaseOrderNumber: poNumber,
          supplierId: Number.isFinite(supplierId) && supplierId > 0 ? supplierId : null,
          supplierName: supplierName || null,
          purchaseItemStatus: String(item?.status || "").trim() || null,
          quantity: Number(item?.quantity) || null,
          expectedOn: po?.expected_on || null,
          orderedAt: po?.ordered_at || null,
          createdAt: po?.created_at || null,
          updatedAt: po?.updated_at || null
        };

        if (inventoryItemId) {
          pushStockyLookupEntry(lookup.byInventoryItemId, String(inventoryItemId), entry);
        }
        if (sku) {
          pushStockyLookupEntry(lookup.bySku, sku, entry);
        }
      }
    }
  } catch (error) {
    console.error("Stocky lookup failed, using fallback lookup:", error);
    if (STOCKY_LOOKUP_CACHE.lookup) {
      return STOCKY_LOOKUP_CACHE.lookup;
    }
    return lookup;
  }

  STOCKY_LOOKUP_CACHE.lookup = lookup;
  STOCKY_LOOKUP_CACHE.expiresAt = Date.now() + STOCKY_CACHE_TTL_MS;
  return lookup;
}

function getStockyMatchForLineItem(lineItem, stockyLookup) {
  if (!stockyLookup) return null;

  const inventoryItemId = parseVariantId(lineItem?.inventory_item_id);
  if (inventoryItemId) {
    const fromInventory = pickBestStockyEntry(stockyLookup.byInventoryItemId.get(String(inventoryItemId)));
    if (fromInventory) return fromInventory;
  }

  const sku = normalizeSkuValue(lineItem?.sku);
  if (sku) {
    const fromSku = pickBestStockyEntry(stockyLookup.bySku.get(sku));
    if (fromSku) return fromSku;
  }

  return null;
}

function normalizeEmailAddress(value) {
  return String(value || "").trim().toLowerCase();
}

function parseDateOrNull(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function draftCustomerContext(draft) {
  const customerId = Number(draft?.customer?.id);
  const email = normalizeEmailAddress(
    draft?.customer?.email || getNoteAttribute(draft?.note_attributes, "Customer Email")
  );

  return {
    customerId: Number.isFinite(customerId) && customerId > 0 ? customerId : null,
    email: email || null
  };
}

function getRequestedVariantIdsForDraft(draft) {
  return collectVariantIdsFromLineItems(draft?.line_items || []);
}

function hasPendingRequestTag(draft) {
  return parseTags(draft?.tags).includes("pending");
}

function hasResolvedPurchasedTag(draft) {
  return parseTags(draft?.tags).includes("resolved-purchased");
}

async function listCandidateOrdersForCustomer(env, customerContext, options = {}) {
  const maxOrders = clampNumber(Number(options?.maxOrders), 1, 250, 50);
  const createdAtMin = options?.createdAtMin || new Date(0).toISOString();

  if (customerContext?.customerId) {
    const path = `/customers/${customerContext.customerId}/orders.json?status=any&limit=${maxOrders}&created_at_min=${encodeURIComponent(createdAtMin)}`;
    const response = await shopifyRest(env, path, "GET");
    return Array.isArray(response?.orders) ? response.orders : [];
  }

  if (customerContext?.email) {
    const path = `/orders.json?status=any&limit=${maxOrders}&created_at_min=${encodeURIComponent(createdAtMin)}`;
    const response = await shopifyRest(env, path, "GET");
    const allOrders = Array.isArray(response?.orders) ? response.orders : [];
    return allOrders.filter(order => normalizeEmailAddress(order?.email) === customerContext.email);
  }

  return [];
}

function getOrderVariantIds(order) {
  return new Set(
    (Array.isArray(order?.line_items) ? order.line_items : [])
      .map(item => parseVariantId(item?.variant_id))
      .filter(Boolean)
      .map(id => String(id))
  );
}

function findPurchaseMatchForDraft(draft, orders) {
  const requestedVariantIds = getRequestedVariantIdsForDraft(draft);
  if (!requestedVariantIds.length) return null;

  const draftCreatedAt = parseDateOrNull(draft?.created_at);
  const orderList = [...(Array.isArray(orders) ? orders : [])]
    .filter(order => !order?.cancelled_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  for (const order of orderList) {
    const orderCreatedAt = parseDateOrNull(order?.created_at);
    if (!orderCreatedAt) continue;
    // Strict guard: only count purchases that happened after the request was created.
    if (draftCreatedAt && orderCreatedAt <= draftCreatedAt) continue;

    const orderVariantIds = getOrderVariantIds(order);
    if (!orderVariantIds.size) continue;

    const matchedVariantIds = requestedVariantIds.filter(variantId => orderVariantIds.has(String(variantId)));
    if (matchedVariantIds.length > 0) {
      return {
        order,
        matchedVariantIds
      };
    }
  }

  return null;
}

async function reconcilePendingRequestsWithOrders(env, options = {}) {
  const lookbackDays = clampNumber(Number(env.RECONCILE_LOOKBACK_DAYS), 1, 365, 90);
  const maxOrdersPerCustomer = clampNumber(Number(env.RECONCILE_MAX_ORDERS_PER_CUSTOMER), 1, 250, 50);
  const lookbackStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const openDrafts = await listOpenRequestDrafts(env);
  const pendingDrafts = openDrafts
    .filter(hasPendingRequestTag)
    .filter(draft => !hasResolvedPurchasedTag(draft));

  const customerGroups = new Map();
  let skippedDrafts = 0;

  for (const draft of pendingDrafts) {
    const requestedVariantIds = getRequestedVariantIdsForDraft(draft);
    if (!requestedVariantIds.length) {
      skippedDrafts++;
      continue;
    }

    const customerContext = draftCustomerContext(draft);
    const customerKey = customerContext.customerId
      ? `id:${customerContext.customerId}`
      : customerContext.email
        ? `email:${customerContext.email}`
        : null;

    if (!customerKey) {
      skippedDrafts++;
      continue;
    }

    const draftCreatedAt = parseDateOrNull(draft?.created_at);
    const effectiveCreatedAt = draftCreatedAt && draftCreatedAt > lookbackStart ? draftCreatedAt : lookbackStart;

    if (!customerGroups.has(customerKey)) {
      customerGroups.set(customerKey, {
        customerContext,
        earliestCreatedAt: effectiveCreatedAt,
        drafts: []
      });
    }

    const group = customerGroups.get(customerKey);
    if (effectiveCreatedAt < group.earliestCreatedAt) {
      group.earliestCreatedAt = effectiveCreatedAt;
    }
    group.drafts.push(draft);
  }

  const result = {
    source: String(options?.source || "manual"),
    scannedDrafts: pendingDrafts.length,
    eligibleDrafts: pendingDrafts.length - skippedDrafts,
    skippedDrafts,
    customerGroups: customerGroups.size,
    matchedDrafts: 0,
    resolvedDrafts: 0,
    deletedDrafts: 0,
    errorCount: 0,
    errors: [],
    resolved: [],
    deleted: []
  };

  for (const [customerKey, group] of customerGroups.entries()) {
    let customerOrders = [];
    try {
      customerOrders = await listCandidateOrdersForCustomer(env, group.customerContext, {
        maxOrders: maxOrdersPerCustomer,
        createdAtMin: group.earliestCreatedAt.toISOString()
      });
    } catch (error) {
      result.errorCount++;
      result.errors.push({
        scope: "order_lookup",
        customerKey,
        error: error?.message || String(error)
      });
      continue;
    }

    for (const draft of group.drafts) {
      const match = findPurchaseMatchForDraft(draft, customerOrders);
      if (!match) continue;

      result.matchedDrafts++;

      try {
        await deleteDraftOrderHard(env, draft.id);
        result.resolvedDrafts++;
        result.deletedDrafts++;
        result.resolved.push({
          draftId: draft.id,
          draftName: draft.name || `#${draft.id}`,
          orderId: match?.order?.id || null,
          orderName: match?.order?.name || null,
          matchedVariantIds: match.matchedVariantIds || []
        });
        result.deleted.push({
          draftId: draft.id,
          draftName: draft.name || `#${draft.id}`,
          orderId: match?.order?.id || null,
          orderName: match?.order?.name || null,
          matchedVariantIds: match.matchedVariantIds || []
        });
      } catch (error) {
        result.errorCount++;
        result.errors.push({
          scope: "delete_draft",
          draftId: draft.id,
          error: error?.message || String(error)
        });
      }
    }
  }

  return result;
}

async function sendReconcileSummary(env, reconcileResult, sourceLabel = "Scheduled") {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.STAFF_EMAIL) return;
  if (!reconcileResult || reconcileResult.deletedDrafts <= 0) return;

  const rows = (reconcileResult.resolved || []).slice(0, 30).map(entry => `
    <li style="margin-bottom: 10px;">
      <strong>${escapeHtmlText(entry.draftName || `#${entry.draftId}`)}</strong>
      <div style="font-size: 13px; color: #666;">
        Matched Order: ${escapeHtmlText(entry.orderName || String(entry.orderId || "unknown"))}
      </div>
      <div style="font-size: 12px; color: #777;">
        Variants: ${escapeHtmlText((entry.matchedVariantIds || []).join(",") || "unknown")}
      </div>
    </li>
  `).join("");

  await sendResend(env, {
    from: env.FROM_EMAIL,
    to: env.STAFF_EMAIL,
    subject: `${sourceLabel} reconcile: ${reconcileResult.deletedDrafts} request(s) auto-deleted`,
    html: `
      <h2 style="margin-bottom: 8px;">Purchase Reconciliation Summary</h2>
      <p style="margin: 0 0 12px;">
        Scanned: ${reconcileResult.scannedDrafts} •
        Matched: ${reconcileResult.matchedDrafts} •
        Deleted: ${reconcileResult.deletedDrafts} •
        Errors: ${reconcileResult.errorCount}
      </p>
      <ol style="padding-left: 20px; margin: 0;">
        ${rows}
      </ol>
    `
  });
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchVariantDetailsMap(env, variantIds) {
  const uniqueIds = Array.from(new Set(
    (variantIds || [])
      .map(id => Number(id))
      .filter(id => Number.isFinite(id) && id > 0)
  ));
  const detailsMap = new Map();
  if (!uniqueIds.length) return detailsMap;

  const idChunks = chunkArray(uniqueIds, 100);
  for (const idChunk of idChunks) {
    const gids = idChunk.map(id => `gid://shopify/ProductVariant/${id}`);
    const data = await shopifyGraphQL(env, `
      query($ids:[ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            legacyResourceId
            sku
            displayName
            inventoryItem {
              legacyResourceId
            }
            product {
              title
              vendor
            }
          }
        }
      }
    `, { ids: gids });

    for (const node of data?.nodes || []) {
      if (!node?.legacyResourceId) continue;
      detailsMap.set(String(node.legacyResourceId), {
        sku: node.sku || "",
        variantTitle: normalizeVariantTitle(node.displayName || ""),
        productTitle: node.product?.title || "",
        vendor: node.product?.vendor || "",
        inventoryItemId: Number(node.inventoryItem?.legacyResourceId) || null
      });
    }
  }

  return detailsMap;
}

async function enrichLineItemsForEmail(lineItems, env) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  if (!items.length) return items;
  const variantIds = collectVariantIdsFromLineItems(items);
  if (!variantIds.length) return items;

  const detailsMap = await fetchVariantDetailsMap(env, variantIds);
  return enrichLineItemsFromMap(items, detailsMap);
}

async function sendPendingReminderDigest(env) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.STAFF_EMAIL) return;

  const minAgeDays = clampNumber(Number(env.REMINDER_MIN_AGE_DAYS), 0, 365, 2);
  const criticalAgeDays = clampNumber(Number(env.REMINDER_CRITICAL_DAYS), 1, 365, 7);
  const maxItems = clampNumber(Number(env.REMINDER_MAX_ITEMS), 1, 200, 40);

  const drafts = await listOpenRequestDrafts(env);
  const now = new Date();
  const pending = drafts.filter(d => parseTags(d.tags).includes("pending"));

  const withReminderState = pending.map(draft => ({
    draft,
    reminder: getReminderState(draft, now)
  }));

  const suppressedCount = withReminderState.filter(x => x.reminder.muted || x.reminder.snoozed).length;
  const actionable = withReminderState
    .filter(x => !x.reminder.muted && !x.reminder.snoozed)
    .filter(x => x.reminder.ageDays >= minAgeDays)
    .sort((a, b) => b.reminder.ageDays - a.reminder.ageDays);

  if (actionable.length === 0) return;

  const criticalCount = actionable.filter(x => x.reminder.ageDays >= criticalAgeDays).length;
  const oldestDays = actionable[0]?.reminder?.ageDays || 0;
  const list = actionable.slice(0, maxItems);
  const digestVariantIds = collectVariantIdsFromDrafts(actionable.map(x => x.draft));
  const digestVariantDetails = await fetchVariantDetailsMap(env, digestVariantIds);

  const rows = list.map(({ draft, reminder }) => {
    const customerName = draft.customer
      ? `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim()
      : "Guest";
    const email = draft.customer?.email || getNoteAttribute(draft.note_attributes, "Customer Email") || "(no email)";
    const enrichedLineItems = enrichLineItemsFromMap(draft.line_items || [], digestVariantDetails);
    const itemSummary = summarizeLineItems(enrichedLineItems, { maxItems: 3, includeVendor: true });
    const adminUrl = `https://${env.SHOPIFY_STORE}/admin/draft_orders/${draft.id}`;

    return `
      <li style="margin-bottom: 14px;">
        <a href="${adminUrl}" style="font-weight: 600;">${escapeHtmlText(draft.name || `#${draft.id}`)}</a>
        <div style="font-size: 14px; color: #555;">
          ${escapeHtmlText(customerName)} • ${escapeHtmlText(email)} • ${reminder.ageDays} day(s) pending
        </div>
        <div style="font-size: 13px; color: #777;">${escapeHtmlText(itemSummary || "No items listed")}</div>
      </li>
    `;
  }).join("");

  const subject = `Order reminders: ${actionable.length} pending (${criticalCount} critical)`;
  const overflowCount = Math.max(0, actionable.length - list.length);

  await sendResend(env, {
    from: env.FROM_EMAIL,
    to: env.STAFF_EMAIL,
    subject,
    html: `
      <h2 style="margin-bottom: 8px;">Pending Order Reminder Digest</h2>
      <p style="margin: 0 0 12px 0;">
        ${actionable.length} order(s) need attention.
        ${criticalCount} are at or above ${criticalAgeDays} days old.
        Oldest is ${oldestDays} days.
      </p>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
        Suppressed by mute/snooze: ${suppressedCount}
      </p>
      <ol style="padding-left: 20px; margin: 0;">
        ${rows}
      </ol>
      ${overflowCount > 0 ? `<p style="margin-top: 12px;">+ ${overflowCount} more not shown</p>` : ""}
      <p style="margin-top: 18px; color: #666; font-size: 13px;">
        Use dashboard actions to snooze or mute reminders for items you know you won't get.
      </p>
    `
  });
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
