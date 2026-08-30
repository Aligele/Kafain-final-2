import { requireAdmin, supabase, todayDate } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const date = req.query.date || todayDate();
    const start = date + "T00:00:00", end = date + "T23:59:59.999";
    const { data, error } = await supabase
      .from("orders").select("id, daily_number, total, payment_method, status, channel, created_at, employee_id")
      .gte("created_at", start).lt("created_at", end).order("created_at", { ascending: false });
    if (error) throw error;
    const { data: employees } = await supabase.from("employees").select("id, name");
    const empMap = Object.fromEntries((employees || []).map((e) => [e.id, e.name]));
    const withNames = data.map((o) => ({ ...o, employee_name: empMap[o.employee_id] || "Unassigned" }));
    return res.status(200).json(withNames);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
