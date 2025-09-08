import mongoose from "mongoose";

const MatchSchema = new mongoose.Schema({
  date: { type: String, required: true },    // ISO yyyy-mm-dd (simple)
  notes: { type: String, default: "" },

  homeId: { type: String, required: true },
  awayId: { type: String, required: true },

  homeGoals: { type: Number, required: true, min: 0 },
  awayGoals: { type: Number, required: true, min: 0 },

  // campos legacy si algún dato los usa:
  homeScorers: { type: [String], default: [] },
  awayScorers: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.models.Match || mongoose.model("Match", MatchSchema);
