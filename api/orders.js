import { supabase, todayDate, readBody, TAX_RATE, LOYALTY_RATE } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const body = await readBody(req);
    const { items, channel, payment_method, employee_id, customer_email } = body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Order must include at least one item." });
    if (!channel || !["counter", "online"].includes(channel)) return res.status(400).json({ error: "channel must be 'counter' or 'online'." });

    const productIds = items.map((i) => i.product_id);
    const { data: products, error: pErr } = await supabase
      .from("products").select("id, name, price, stock_grams, grams_per_unit").in("id", productIds);
    if (pErr) throw pErr;
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    let subtotal = 0;
    for (const item of items) {
      const p = productMap[item.product_id];
      if (!p) return res.status(400).json({ error: `Unknown product_id ${item.product_id}` });
      if (!item.quantity || item.quantity <= 0) return res.status(400).json({ error: "Each item needs a positive quantity." });
      const neededGrams = (p.grams_per_unit || 0) * item.quantity;
      if (neededGrams > p.stock_grams) return res.status(409).json({ error: `Not enough stock for ${p.name}.` });
      subtotal += p.price * item.quantity;
    }

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const todayStart = todayDate() + "T00:00:00";
    const { count: dayCount } = await supabase
      .from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStart);
    const dailyNumber = (dayCount || 0) + 1;

    let employeeName = null;
    if (employee_id) {
      const { data: emp } = await supabase.from("employees").select("name").eq("id", employee_id).single();
      employeeName = emp ? emp.name : null;
    }

    let customerId = null;
    if (customer_email) {
      const { data: existing } = await supabase.from("customers").select("id, loyalty_points").eq("email", customer_email).single();
      if (existing) {
        customerId = existing.id;
        await supabase.from("customers").update({ loyalty_points: existing.loyalty_points + subtotal * LOYALTY_RATE }).eq("id", customerId);
      } else {
        const { data: inserted } = await supabase.from("customers").insert({ email: customer_email, loyalty_points: subtotal * LOYALTY_RATE }).select("id").single();
        customerId = inserted.id;
      }
    }

    const { data: order, error: oErr } = await supabase.from("orders").insert({
      customer_id: customerId, employee_id: employee_id || null, channel,
      payment_method: payment_method || "unspecified", subtotal, tax, total, daily_number: dailyNumber,
    }).select("id, created_at").single();
    if (oErr) throw oErr;

    const receiptItems = [];
    for (const item of items) {
      const p = productMap[item.product_id];
      await supabase.from("order_items").insert({
        order_id: order.id, product_id: item.product_id, quantity: item.quantity, unit_price: p.price, notes: item.notes || null,
      });
      const neededGrams = (p.grams_per_unit || 0) * item.quantity;
      await supabase.from("products").update({ stock_grams: p.stock_grams - neededGrams }).eq("id", p.id);
      receiptItems.push({ name: p.name, quantity: item.quantity, unit_price: p.price, line_total: p.price * item.quantity });
    }

    return res.status(201).json({
      order_id: order.id, daily_number: dailyNumber, subtotal, tax, total,
      customer_id: customerId, employee_name: employeeName, created_at: order.created_at, items: receiptItems,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
