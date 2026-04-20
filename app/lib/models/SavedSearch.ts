import mongoose, { Schema, models } from "mongoose";

const SavedSearchSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    query: { type: String, required: true },
    maxPrice: { type: Number, required: true },
    lastNotifiedPrice: { type: Number, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const SavedSearch = models.SavedSearch ?? mongoose.model("SavedSearch", SavedSearchSchema);
export default SavedSearch;
