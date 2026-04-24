import mongoose, { Schema, models } from "mongoose";

const ProductCacheSchema = new Schema({
  query: { type: String, required: true, unique: true, lowercase: true, trim: true },
  products: { type: Schema.Types.Mixed, required: true },
  lastUpdated: { type: Date, default: Date.now },
});

// TTL index — MongoDB auto-deletes docs older than 24h
ProductCacheSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 86400 });

const ProductCache =
  models.ProductCache ?? mongoose.model("ProductCache", ProductCacheSchema);

export default ProductCache;
