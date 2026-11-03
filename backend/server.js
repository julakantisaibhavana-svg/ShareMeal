
const authMiddleware = require("./middleware/authMiddleware");
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const FoodDonation = require("./models/FoodDonation");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

// Home route
app.get("/", (req, res) => {
  res.send("ShareMeal backend is running successfully!");
});

// API health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ShareMeal API is working!",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// Get all food donations

app.get("/api/donations", async (req, res) => {
  try {
    // Mark overdue available donations as expired
    await FoodDonation.updateMany(
      {
        status: "Available",
        pickupDeadline: { $lte: new Date() },
      },
      {
        $set: { status: "Expired" },
      }
    );

    // Show nearest pickup deadlines first
    const donations = await FoodDonation.find().sort({
      pickupDeadline: 1,
    });

    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Add a food donation

app.post("/api/donations", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "donor") {
      return res.status(403).json({
        message: "Only donors can add food donations",
      });
    }

    const {
      donorName,
      foodName,
      category,
      quantity,
      location,
      pickupDeadline,
    } = req.body;

    const donation = await FoodDonation.create({
      donorName,
      foodName,
      category,
      quantity,
      location,
      pickupDeadline,
      donor: req.user.userId,
      status: "Available",
    });

    res.status(201).json(donation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Update donation status

app.patch("/api/donations/:id", authMiddleware, async (req, res) => {
  try {
    const donation = await FoodDonation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found",
      });
    }

    // Receiver can reserve available food
    if (req.body.status === "Reserved") {
      if (req.user.role !== "receiver") {
        return res.status(403).json({
          message: "Only receivers can reserve food",
        });
      }

      if (donation.pickupDeadline <= new Date()) {
  donation.status = "Expired";
  await donation.save();

  return res.status(400).json({
    message: "This food donation has expired",
  });
}

if (donation.status !== "Available") {
  return res.status(400).json({
    message: "This food is not available",
  });
}

      donation.status = "Reserved";
      donation.reservedBy = req.user.userId;
    }

    // Only the receiver who reserved it can collect it
    else if (req.body.status === "Collected") {
      if (req.user.role !== "receiver") {
        return res.status(403).json({
          message: "Only receivers can collect food",
        });
      }

      if (donation.status !== "Reserved") {
        return res.status(400).json({
          message: "Only reserved food can be collected",
        });
      }

      if (
        !donation.reservedBy ||
        donation.reservedBy.toString() !== req.user.userId
      ) {
        return res.status(403).json({
          message: "Only the receiver who reserved this food can collect it",
        });
      }

      donation.status = "Collected";
    }

    else {
      return res.status(400).json({
        message: "Invalid status transition",
      });
    }

    await donation.save();

    res.json(donation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


app.delete("/api/donations/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "donor") {
      return res.status(403).json({
        message: "Only donors can delete donations",
      });
    }

    const donation = await FoodDonation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found",
      });
    }

    if (
      !donation.donor ||
      donation.donor.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        message: "You can only delete your own donations",
      });
    }

    if (donation.status !== "Available") {
      return res.status(400).json({
        message: "Only available donations can be deleted",
      });
    }

    await donation.deleteOne();

    res.json({
      message: "Donation deleted successfully",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Start server after connecting to MongoDB
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`ShareMeal server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}

startServer();
