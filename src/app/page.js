"use client";

import { useEffect, useMemo, useState } from "react";

// === Config ===
const GROUPS = ["A", "B", "C", "D", "E"];

// === Página principal ===
export default function Home() {
  // Datos base
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  // Fase final la guardamos local (si quieres luego la pasamos a una API /api/knockout)
  const [knockouts, setKnockouts] = useState([]);

  // Estado conexión
  const [usingApi, setUsingApi] = useState(true);
  const [apiError, setApiError] = useState(null);

  // UI: pestañas
  const [view, setView] = useState("groups"); // "groups" | "final"

  // Formularios
  const [teamName, setTeamName] = useState("");
  const [teamGroup, setTeamGroup] = useState("A");

  const [matchForm, setMatchForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    homeId: "",
    awayId: "",
    homeGoals: 0,
    awayGoals: 0,
  });

  const [kForm, setKForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    notes: "Octavos/Cuartos/Semi/Final",
    homeId: "",
    awayId: "",
    homeGoals: 0,
    awayGoals: 0,
  });

  // ---- Cargar datos desde /api
  async function loadAll() {
    try {
      const fetchOpts = { cache: "no-store" };
      const [tRes, mRes] = await Promise.all([
        fetch("/api/teams", fetchOpts),
        fetch("/api/matches", fetchOpts),
      ]);
      if (!tRes.ok) throw new Error("teams " + tRes.status);
      if (!mRes.ok) throw new Error("matches " + mRes.status);
      const [t, m] = await Promise.all([tRes.json(), mRes.json()]);
      setTeams(t);
      setMatches(m);
      setUsingApi(true);
      setApiError(null);
    } catch (err) {
      console.error("LoadAll FAIL:", err);
      setUsingApi(false);
      setApiError("No se pudo conectar con la API.");
    }
  }

  useEffect(() => {
    loadAll();
    // intenta restaurar fase final local
    try {
      const raw = localStorage.getItem("knockouts_v1");
      if (raw) setKnockouts(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    // persistir fase final localmente
    try {
      localStorage.setItem("knockouts_v1", JSON.stringify(knockouts));
    } catch {}
  }, [knockouts]);

  // Índices útiles
  const teamById = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams]
  );
  const idToGroup = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.group])),
    [teams]
  );

  // === Tablas por grupo
  const standingsByGroup = useMemo(() => {
    // base
    const base = {};
    for (const g of GROUPS) {
      base[g] = Object.fromEntries(
        teams
          .filter((t) => t.group === g)
          .map((t) => [
            t.id,
            {
              team: t,
              pld: 0,
              w: 0,
              d: 0,
              l: 0,
              gf: 0,
              ga: 0,
              gd: 0,
              pts: 0,
            },
          ])
      );
    }
    // sumar
    for (const m of matches) {
      const gHome = idToGroup[m.homeId];
      const gAway = idToGroup[m.awayId];
      if (!gHome || gHome !== gAway) continue; // solo partidos dentro del mismo grupo
      const table = base[gHome];
      if (!table || !table[m.homeId] || !table[m.awayId]) continue;

      const home = table[m.homeId];
      const away = table[m.awayId];
      const hg = Number(m.homeGoals) || 0;
      const ag = Number(m.awayGoals) || 0;

      home.pld++;
      away.pld++;

      home.gf += hg;
      home.ga += ag;
      home.gd = home.gf - home.ga;

      away.gf += ag;
      away.ga += hg;
      away.gd = away.gf - away.ga;

      if (hg > ag) {
        home.w++;
        home.pts += 3;
        away.l++;
      } else if (hg < ag) {
        away.w++;
        away.pts += 3;
        home.l++;
      } else {
        home.d++;
        away.d++;
        home.pts++;
        away.pts++;
      }
    }
    // salida ordenada
    const out = {};
    for (const g of GROUPS) {
      out[g] = Object.values(base[g] || {})
        .sort((a, b) => {
          if (b.pts !== a.pts) return b.pts - a.pts;
          if (b.gd !== a.gd) return b.gd - a.gd;
          if (b.gf !== a.gf) return b.gf - a.gf;
          return a.team.name.localeCompare(b.team.name);
        })
        .map((row, i) => ({ pos: i + 1, ...row }));
    }
    return out;
  }, [teams, matches, idToGroup]);

  // Clasificados (1º y 2º de cada grupo)
  const qualifiers = useMemo(
    () =>
      GROUPS.flatMap((g) =>
        (standingsByGroup[g] || []).slice(0, 3).map((r) => r.team)
      ),
    [standingsByGroup]
  );

  // Tabla única fase final (a partir de knockouts registrados)
  const standingsFinal = useMemo(() => {
    const ids = new Set();
    knockouts.forEach((m) => {
      ids.add(m.homeId);
      ids.add(m.awayId);
    });
    const base = Object.fromEntries(
      [...ids].map((id) => [
        id,
        {
          team: teamById[id] || { id, name: "(Equipo)" },
          pld: 0,
          w: 0,
          d: 0,
          l: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          pts: 0,
        },
      ])
    );
    for (const m of knockouts) {
      const home = base[m.homeId];
      const away = base[m.awayId];
      if (!home || !away) continue;
      const hg = Number(m.homeGoals) || 0;
      const ag = Number(m.awayGoals) || 0;

      home.pld++;
      away.pld++;

      home.gf += hg;
      home.ga += ag;
      home.gd = home.gf - home.ga;

      away.gf += ag;
      away.ga += hg;
      away.gd = away.gf - away.ga;

      if (hg > ag) {
        home.w++;
        home.pts += 3;
        away.l++;
      } else if (hg < ag) {
        away.w++;
        away.pts += 3;
        home.l++;
      } else {
        home.d++;
        away.d++;
        home.pts++;
        away.pts++;
      }
    }
    return Object.values(base)
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.team.name.localeCompare(b.team.name);
      })
      .map((row, i) => ({ pos: i + 1, ...row }));
  }, [knockouts, teamById]);

  // ---- Acciones API
  async function addTeam(e) {
    e.preventDefault();
    const name = teamName.trim();
    if (!name) return;
    if (!GROUPS.includes(teamGroup)) return alert("Grupo inválido");

    // evitar duplicados
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      alert("Ese equipo ya existe");
      return;
    }
    // --- Limitar equipos por grupo ---
    const maxByGroup = { A: 6, B: 6, C: 5, D: 5, E: 5 };
    const groupCount = teams.filter((t) => t.group === teamGroup).length;
    if (groupCount >= maxByGroup[teamGroup]) {
      alert(
        `El grupo ${teamGroup} ya tiene el máximo de ${maxByGroup[teamGroup]} equipos`
      );
      return;
    }

    const res = await fetch("/api/teams", {
      method: "POST",
      body: JSON.stringify({ name, group: teamGroup }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error || "No se pudo crear el equipo");
      return;
    }
    const created = await res.json();
    setTeams((xs) => [...xs, created]);
    setTeamName("");
    setTeamGroup("A");
  }

  async function removeTeam(id) {
    if (!confirm("¿Eliminar equipo? También se eliminarán sus partidos."))
      return;
    const res = await fetch(`/api/teams?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error || "No se pudo eliminar el equipo");
      return;
    }
    setTeams((xs) => xs.filter((t) => t.id !== id));
    setMatches((ms) => ms.filter((m) => m.homeId !== id && m.awayId !== id));
    setKnockouts((ks) => ks.filter((m) => m.homeId !== id && m.awayId !== id));
  }

  async function addMatch(e) {
    e.preventDefault();
    const { homeId, awayId, homeGoals, awayGoals } = matchForm;
    if (!homeId || !awayId) return alert("Selecciona local y visitante");
    if (homeId === awayId)
      return alert("Un equipo no puede jugar contra sí mismo");

    const payload = {
      ...matchForm,
      homeGoals: Number(homeGoals) || 0,
      awayGoals: Number(awayGoals) || 0,
    };
    const res = await fetch("/api/matches", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error || "No se pudo crear el partido");
      return;
    }
    const created = await res.json();
    setMatches((xs) => [...xs, created]);
    setMatchForm((f) => ({ ...f, homeGoals: 0, awayGoals: 0, notes: "" }));
  }

  async function removeMatch(id) {
    if (!confirm("¿Eliminar este partido?")) return;
    const res = await fetch(`/api/matches?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error || "No se pudo eliminar el partido");
      return;
    }
    setMatches((xs) => xs.filter((m) => m.id !== id));
  }

  // Fase final (local)
  async function addKnockout(e) {
    e.preventDefault();
    const { homeId, awayId, homeGoals, awayGoals } = kForm;
    if (!homeId || !awayId) return alert("Selecciona ambos equipos");
    if (homeId === awayId)
      return alert("Un equipo no puede jugar contra sí mismo");
    setKnockouts((xs) => [
      ...xs,
      {
        id: crypto.randomUUID(),
        date: kForm.date,
        notes: kForm.notes,
        homeId,
        awayId,
        homeGoals: Number(homeGoals) || 0,
        awayGoals: Number(awayGoals) || 0,
      },
    ]);
    setKForm((f) => ({ ...f, homeGoals: 0, awayGoals: 0, notes: "" }));
  }

  function removeKnockout(id) {
    if (!confirm("¿Eliminar este partido?")) return;
    setKnockouts((xs) => xs.filter((m) => m.id !== id));
  }

  // ---- UI
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">🏆 Torneo PMC — Next.js</h1>
            <p className="text-sm text-gray-600">
              {usingApi ? (
                <>
                  Conectado a backend{" "}
                  <span className="font-semibold">(Mongo/API)</span>.
                </>
              ) : (
                <>No se pudo conectar con la API.</>
              )}
            </p>
            {apiError && (
              <p className="text-xs text-red-600 mt-1">{apiError}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                try {
                  localStorage.removeItem("knockouts_v1");
                } catch {}
                setKnockouts([]);
              }}
              className="px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition"
            >
              Limpiar fase final (local)
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow p-2 flex gap-2 w-fit">
          <button
            onClick={() => setView("groups")}
            className={`px-3 py-1 rounded-xl ${
              view === "groups" ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            Fase de grupos
          </button>
          <button
            onClick={() => setView("final")}
            className={`px-3 py-1 rounded-xl ${
              view === "final" ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            Fase final
          </button>
        </div>

        {view === "groups" && (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Equipos */}
              <section className="bg-white rounded-2xl shadow p-4">
                <h2 className="text-xl font-semibold mb-3">Equipos</h2>
                <form onSubmit={addTeam} className="flex gap-2 mb-3">
                  <input
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-300"
                    placeholder="Nombre del equipo"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                  <select
                    className="px-3 py-2 rounded-xl border border-gray-300"
                    value={teamGroup}
                    onChange={(e) => setTeamGroup(e.target.value)}
                  >
                    {GROUPS.map((g) => (
                      <option key={g} value={g}>
                        Grupo {g}
                      </option>
                    ))}
                  </select>
                  <button className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                    Agregar
                  </button>
                </form>
                {teams.length === 0 ? (
                  <p className="text-sm text-gray-600">Aún no hay equipos.</p>
                ) : (
                  <ul className="divide-y">
                    {teams.map((t) => (
                      <li
                        key={t.id}
                        className="py-2 flex items-center justify-between"
                      >
                        <span>
                          {t.name}{" "}
                          <span className="text-xs text-gray-500">
                            (Grupo {t.group})
                          </span>
                        </span>
                        <button
                          onClick={() => removeTeam(t.id)}
                          className="text-red-600 text-sm hover:underline"
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Registrar partido (grupos) */}
              <section className="bg-white rounded-2xl shadow p-4">
                <h2 className="text-xl font-semibold mb-3">
                  Registrar partido (grupos)
                </h2>
                <form onSubmit={addMatch} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm">
                      Fecha
                      <input
                        type="date"
                        value={matchForm.date}
                        onChange={(e) =>
                          setMatchForm({ ...matchForm, date: e.target.value })
                        }
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                      />
                    </label>
                    <label className="text-sm">
                      Notas
                      <input
                        type="text"
                        value={matchForm.notes}
                        onChange={(e) =>
                          setMatchForm({ ...matchForm, notes: e.target.value })
                        }
                        placeholder="Jornada 1, Árbitro, etc."
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm">
                      Local
                      <select
                        value={matchForm.homeId}
                        onChange={(e) =>
                          setMatchForm({ ...matchForm, homeId: e.target.value })
                        }
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                      >
                        <option value="">— Selecciona —</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (G{t.group})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      Visitante
                      <select
                        value={matchForm.awayId}
                        onChange={(e) =>
                          setMatchForm({ ...matchForm, awayId: e.target.value })
                        }
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                      >
                        <option value="">— Selecciona —</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (G{t.group})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm">
                      Goles local
                      <input
                        type="number"
                        min={0}
                        value={matchForm.homeGoals}
                        onChange={(e) =>
                          setMatchForm({
                            ...matchForm,
                            homeGoals: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                      />
                    </label>
                    <label className="text-sm">
                      Goles visitante
                      <input
                        type="number"
                        min={0}
                        value={matchForm.awayGoals}
                        onChange={(e) =>
                          setMatchForm({
                            ...matchForm,
                            awayGoals: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
                      Guardar partido
                    </button>
                  </div>
                </form>
              </section>
            </div>

            {/* Tablas por grupo */}
            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="text-xl font-semibold mb-3">Tablas por grupo</h2>
              {teams.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Agrega equipos para ver las tablas.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {GROUPS.map((g) => (
                    <div key={g} className="border rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-gray-100 font-semibold">
                        Grupo {g}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              {[
                                "Pos",
                                "Equipo",
                                "PJ",
                                "G",
                                "E",
                                "P",
                                "GF",
                                "GC",
                                "DG",
                                "Pts",
                              ].map((h) => (
                                <th
                                  key={h}
                                  className="px-2 py-2 text-left font-semibold"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(standingsByGroup[g] || []).length === 0 ? (
                              <tr>
                                <td
                                  className="px-2 py-2 text-gray-500"
                                  colSpan={10}
                                >
                                  Sin equipos
                                </td>
                              </tr>
                            ) : (
                              (standingsByGroup[g] || []).map((row) => (
                                <tr
                                  key={row.team.id}
                                  className="border-b last:border-b-0"
                                >
                                  <td className="px-2 py-2 font-medium">
                                    {row.pos}
                                  </td>
                                  <td className="px-2 py-2">{row.team.name}</td>
                                  <td className="px-2 py-2">{row.pld}</td>
                                  <td className="px-2 py-2">{row.w}</td>
                                  <td className="px-2 py-2">{row.d}</td>
                                  <td className="px-2 py-2">{row.l}</td>
                                  <td className="px-2 py-2">{row.gf}</td>
                                  <td className="px-2 py-2">{row.ga}</td>
                                  <td className="px-2 py-2">{row.gd}</td>
                                  <td className="px-2 py-2 font-bold">
                                    {row.pts}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Partidos (fase de grupos) */}
            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="text-xl font-semibold mb-3">
                Partidos (fase de grupos)
              </h2>
              {matches.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Aún no registras partidos.
                </p>
              ) : (
                <ul className="space-y-2">
                  {matches
                    .slice()
                    .reverse()
                    .map((m) => (
                      <li
                        key={m.id}
                        className="p-3 border rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                      >
                        <div className="flex-1">
                          <div className="text-sm text-gray-500">
                            {m.date} {m.notes ? `• ${m.notes}` : ""}
                          </div>
                          <div className="text-lg font-semibold">
                            {teamById[m.homeId]?.name || "(Local)"}{" "}
                            {m.homeGoals} - {m.awayGoals}{" "}
                            {teamById[m.awayId]?.name || "(Visitante)"}
                          </div>
                        </div>
                        <button
                          onClick={() => removeMatch(m.id)}
                          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200"
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </>
        )}

        {view === "final" && (
          <>
            {/* Clasificados */}
            <section className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">
                  Clasificados (1º y 2º de cada grupo)
                </h2>
                <span className="text-xs text-gray-500">
                  {qualifiers.length}/15
                </span>
              </div>
              {qualifiers.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Aún no hay clasificados; completa la fase de grupos.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {qualifiers.map((t) => (
                    <div
                      key={t.id}
                      className="px-3 py-2 border rounded-xl bg-gray-50 flex items-center justify-between"
                    >
                      <span>{t.name}</span>
                      <span className="text-xs text-gray-500">G{t.group}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Registrar partido (fase final) */}
            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="text-xl font-semibold mb-3">
                Registrar partido (fase final)
              </h2>
              <form onSubmit={addKnockout} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    Fecha
                    <input
                      type="date"
                      value={kForm.date}
                      onChange={(e) =>
                        setKForm({ ...kForm, date: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                    />
                  </label>
                  <label className="text-sm">
                    Notas
                    <input
                      type="text"
                      value={kForm.notes}
                      onChange={(e) =>
                        setKForm({ ...kForm, notes: e.target.value })
                      }
                      placeholder="Octavos/Cuartos/Semi/Final"
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    Equipo A
                    <select
                      value={kForm.homeId}
                      onChange={(e) =>
                        setKForm({ ...kForm, homeId: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                    >
                      <option value="">— Selecciona —</option>
                      {qualifiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (G{t.group})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Equipo B
                    <select
                      value={kForm.awayId}
                      onChange={(e) =>
                        setKForm({ ...kForm, awayId: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                    >
                      <option value="">— Selecciona —</option>
                      {qualifiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (G{t.group})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    Goles A
                    <input
                      type="number"
                      min={0}
                      value={kForm.homeGoals}
                      onChange={(e) =>
                        setKForm({ ...kForm, homeGoals: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                    />
                  </label>
                  <label className="text-sm">
                    Goles B
                    <input
                      type="number"
                      min={0}
                      value={kForm.awayGoals}
                      onChange={(e) =>
                        setKForm({ ...kForm, awayGoals: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300"
                    />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
                    Guardar partido
                  </button>
                </div>
              </form>
            </section>

            {/* Tabla única fase final */}
            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="text-xl font-semibold mb-3">Tabla (fase final)</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {[
                        "Pos",
                        "Equipo",
                        "PJ",
                        "G",
                        "E",
                        "P",
                        "GF",
                        "GC",
                        "DG",
                        "Pts",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-2 py-2 text-left font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {standingsFinal.length === 0 ? (
                      <tr>
                        <td className="px-2 py-2 text-gray-500" colSpan={10}>
                          Aún no hay partidos en fase final.
                        </td>
                      </tr>
                    ) : (
                      standingsFinal.map((row) => (
                        <tr
                          key={row.team.id}
                          className="border-b last:border-b-0"
                        >
                          <td className="px-2 py-2 font-medium">{row.pos}</td>
                          <td className="px-2 py-2">{row.team.name}</td>
                          <td className="px-2 py-2">{row.pld}</td>
                          <td className="px-2 py-2">{row.w}</td>
                          <td className="px-2 py-2">{row.d}</td>
                          <td className="px-2 py-2">{row.l}</td>
                          <td className="px-2 py-2">{row.gf}</td>
                          <td className="px-2 py-2">{row.ga}</td>
                          <td className="px-2 py-2">{row.gd}</td>
                          <td className="px-2 py-2 font-bold">{row.pts}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Partidos (fase final) */}
            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="text-xl font-semibold mb-3">
                Partidos (fase final)
              </h2>
              {knockouts.length === 0 ? (
                <p className="text-sm text-gray-600">Sin partidos aún.</p>
              ) : (
                <ul className="space-y-2">
                  {knockouts
                    .slice()
                    .reverse()
                    .map((m) => (
                      <li
                        key={m.id}
                        className="p-3 border rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm text-gray-500">
                            {m.date} {m.notes ? `• ${m.notes}` : ""}
                          </div>
                          <div className="text-lg font-semibold">
                            {teamById[m.homeId]?.name || "(A)"} {m.homeGoals} -{" "}
                            {m.awayGoals} {teamById[m.awayId]?.name || "(B)"}
                          </div>
                        </div>
                        <button
                          onClick={() => removeKnockout(m.id)}
                          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200"
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
