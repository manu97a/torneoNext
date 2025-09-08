import { dbConnect } from "../../../../lib/mongodb";
import Match from "../../../../models/Match";

// GET /api/matches
export async function GET() {
  await dbConnect();
  const ms = await Match.find().sort({ createdAt: 1 });
  const out = ms.map(m => ({
    id: String(m._id),
    date: m.date,
    homeId: m.homeId,
    awayId: m.awayId,
    homeGoals: m.homeGoals,
    awayGoals: m.awayGoals,
    homeScorers: m.homeScorers,
    awayScorers: m.awayScorers,
    notes: m.notes,
  }));
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/matches
export async function POST(req) {
  await dbConnect();
  try {
    const p = await req.json();
    const required = ["date", "homeId", "awayId", "homeGoals", "awayGoals"];
    if (!required.every(k => p[k] !== undefined && p[k] !== ""))
      return Response.json({ error: "Campos obligatorios faltantes" }, { status: 400 });

    const created = await Match.create(p);
    return Response.json({
      id: String(created._id),
      date: created.date,
      homeId: created.homeId,
      awayId: created.awayId,
      homeGoals: created.homeGoals,
      awayGoals: created.awayGoals,
      homeScorers: created.homeScorers,
      awayScorers: created.awayScorers,
      notes: created.notes,
    }, { status: 201 });
  } catch (e) {
    console.error("POST /api/matches error:", e);
    return Response.json({ error: "Error creando partido" }, { status: 500 });
  }
}

// DELETE /api/matches?id=<id>
export async function DELETE(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });

  try {
    await Match.deleteOne({ _id: id });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/matches error:", e);
    return Response.json({ error: "Error eliminando partido" }, { status: 500 });
  }
}
