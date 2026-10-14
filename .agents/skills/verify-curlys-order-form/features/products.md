# Products and line items

Staff choose catalog variants by text, barcode or SKU, adjust quantities, remove
items, or add a priced custom item when it is not in the catalog.

## Sub-features

- `product-text`: expand a grouped product and select a variant.
- `product-identifier`: barcode and SKU each select a standalone variant.
- `line-quantity-remove`: quantity updates totals; remove restores the empty list.
- `line-custom`: add a named, priced custom line with its quantity.
- `product-empty-close`: no-match text and Escape dismissal are visible.

## How to get to it (user POV)

- Open `/` and type a name, barcode or SKU in **Search Products**.
- Click a product group, then the desired variant; identifier results are clicked directly.
- Edit the quantity beside a line or click its **Remove** (×) button.
- Choose **+ Add Custom Item**, fill Title/Price/Quantity, then **Add Custom Item**.

## Driving it with Playwright

Preconditions: fresh launch, passing doctor, both Verify Protein variants seeded.

Run `node "$S/drive.mjs" "$RUN" products --headless`.

- **Text entry.** Fill exact label `Search Products` with `protein`. Click
  `.product-header` containing `Verify Protein`, then `.variant-item` containing
  `Chocolate`. `#lineItemsList` contains Chocolate; `#totalAmount` is `$12.50`.
- **Quantity/remove.** Fill `.line-item-quantity` with `3`, press `Tab` to commit
  the change; total becomes `$37.50`. Click `getByTitle('Remove', {exact: true})`;
  `#emptyLineItems` is visible.
- **Barcode entry.** Search `9900000000201`, click `#productResults .autocomplete-item`
  containing Chocolate. Total is `$12.50`. Capture `barcode.png`, then remove.
- **SKU entry.** Search `VERIFY-201`, click the same standalone result and assert
  `$12.50`. Capture `sku.png`, then remove. Barcode proof does not stand in for SKU.
- **Custom entry.** Click `+ Add Custom Item`; fill exact labels Title with
  `Verify Bottle`, Price with `7.50`, Quantity with `2`. Click exact button
  `Add Custom Item`; total is `$15.00` and the custom line is visible.
- **No match/dismiss.** Search `volcano`; require `No products found` in
  `#productResults`. Press `Escape` in the search field; results are hidden.
- **Proof.** `steps.json`, expanded/quantity/barcode/SKU/custom screenshots and
  ARIA snapshots show each action and total. The final audit requires zero
  mutation requests, unchanged draft count and no notification captures.

## Gotchas

- Product search debounces 600 ms. Wait for the specific result.
- The Remove button's accessible name is ×; its stable title is `Remove`.
- A physical scanner is not exercised; typing the barcode proves the text-input
  route, not scanner hardware, timing or focus behavior.
- Vanilla has three in stock, but the recipe chooses Chocolate. Inventory warning
  and **Confirm 0 and update Shopify** are unverified. The inventory-zero endpoint
  is blocked by the adapter, not silently treated as success.
- This two-variant fixture does not prove result saturation, ranking over a real
  catalog or Shopify search semantics; use the existing offline search tests too.
