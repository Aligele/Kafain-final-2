import { supabase, readBody } from "../../lib/db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data, error } = await supabase.from("products").select("*").order("category").order("name");
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const { sku, name, category, price, cost, stock_grams, grams_per_unit } = await readBody(req);
      if (!sku || !name || !category || price == null || cost == null) {
        return res.status(400).json({ error: "sku, name, category, price, and cost are required." });
      }
      const { error } = await supabase.from("products").insert({
        sku, name, category, price, cost, stock_grams: stock_grams || 0, grams_per_unit: grams_per_unit || 0,
      });
      if (error) throw error;
      return res.status(201).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
