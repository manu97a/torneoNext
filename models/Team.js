import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true, trim: true },
  group: { type: String, enum: ["A","B","C","D","E","F","G","H"], required: true },
}, { timestamps: true });

export default mongoose.models.Team || mongoose.model("Team", TeamSchema);
