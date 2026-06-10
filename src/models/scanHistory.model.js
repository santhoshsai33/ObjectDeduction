import mongoose from 'mongoose';

const scanProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    count: {
      type: Number,
      required: true,
      min: 0
    },
    currentCount: {
      type: Number,
      default: 0,
      min: 0
    },
    previousCount: {
      type: Number,
      default: 0,
      min: 0
    },
    cumulativeCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: false }
);

const scanHistorySchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      trim: true,
      default: ''
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true
    },
    matched: {
      type: Boolean,
      default: false
    },
    products: {
      type: [scanProductSchema],
      default: []
    },
    totalCount: {
      type: Number,
      default: 0,
      min: 0
    },
    rawPredictions: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

scanHistorySchema.index({ vendorId: 1, scannedAt: -1 });
scanHistorySchema.index({ matched: 1, scannedAt: -1 });

const ScanHistory = mongoose.model('ScanHistory', scanHistorySchema);

export default ScanHistory;
