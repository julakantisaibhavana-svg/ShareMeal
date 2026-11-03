
const mongoose = require("mongoose");

const foodDonationSchema = new mongoose.Schema(
  {
    donorName: {
      type: String,
      required: true,
      trim: true,
    },

    foodName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
    },

    quantity: {
      type: String,
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    pickupDeadline: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["Available", "Reserved", "Collected", "Expired"],
      default: "Available",
    },

    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reservedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FoodDonation", foodDonationSchema);
