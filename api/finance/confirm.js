import { requireAdmin, supabase, readBody } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const { order_id, payment_method } = await readBody(req);
    if (!order_id) return res.status(400).json({ error: "order_id is required" });
    if (!payment_method || !["cash", "mpesa"].includes(payment_method)) {
      return res.status(400).json({ error: "payment_method must be 'cash' or 'mpesa'." });
    }

    const { data: existing } = await supabase.from("orders").select("status").eq("id", order_id).single();
    if (!existing) return res.status(404).json({ error: "Order not found." });
    if (existing.status !== "pending") return res.status(409).json({ error: `Order is already ${existing.status}.` });

    const { data: updated, error } = await supabase
      .from("orders")
      .update({ status: "completed", payment_method })
      .eq("id", order_id)
      .select("*")
      .single();
    if (error) throw error;

    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
