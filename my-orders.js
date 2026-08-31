import { supabase, todayDate } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const employeeId = req.query.employee_id;
    const date = req.query.date || todayDate();
    if (!employeeId) return res.status(400).json({ error: "employee_id is required" });
    const { data, error } = await supabase
      .from("orders")
      .select("id, daily_number, subtotal, tax, total, payment_method, created_at")
      .eq("employee_id", employeeId)
      .gte("created_at", date + "T00:00:00")
      .lt("created_at", date + "T23:59:59.999")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
