import mongoose, { Schema, models } from "mongoose";

const SearchLogSchema = new Schema(
  {
    userId: { type: String, default: "guest" },
    userName: { type: String, default: "Guest" },
    userEmail: { type: String, default: "" },
    query: { type: String, required: true, lowercase: true, trim: true },
    resultsCount: { type: Number, default: 0 },
    filters: {
      maxPrice: { type: Number, default: null },
      maxDays: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

const SearchLog = models.SearchLog ?? mongoose.model("SearchLog", SearchLogSchema);
export default SearchLog;
