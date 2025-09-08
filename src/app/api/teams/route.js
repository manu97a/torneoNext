import { dbConnect } from "../../../../lib/mongodb";
import Team from "../../../../models/Team";
import Match from "../../../../models/Match";

// GET /api/teams
export async function GET() {
  await dbConnect();
  const teams = await Team.find().sort({ name: 1 });
  return Response.json(teams.map(t => ({ id: String(t._id), name: t.name, group: t.group })), {
    headers: { "Cache-Control": "no-store" }
  });
}

// POST /api/teams
export async function POST(req) {
  await dbConnect();
  try {
    const { name, group } = await req.json();
    const GROUPS = ["A","B","C","D","E","F","G","H"];
    if (!name || !GROUPS.includes(group)) {
      return Response.json({ error: "name y group requeridos (A-H)" }, { status: 400 });
    }
    const created = await Team.create({ name: String(name).trim(), group });
    return Response.json({ id: String(created._id), name: created.name, group: created.group }, { status: 201 });
  } catch (e) {
    if (e?.code === 11000) return Response.json({ error: "Equipo ya existe" }, { status: 409 });
    console.error("POST /api/teams error:", e);
    return Response.json({ error: "Error creando equipo" }, { status: 500 });
  }
}

// DELETE /api/teams?id=<id>
export async function DELETE(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });

  try {
    await Team.deleteOne({ _id: id });
    await Match.deleteMany({ $or: [{ homeId: id }, { awayId: id }] });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/teams error:", e);
    return Response.json({ error: "Error eliminando equipo" }, { status: 500 });
  }
}
