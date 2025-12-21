const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://scholarstream-client-two.vercel.app",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = require("./middlewares/verifyToken");

const uri = process.env.MONGODB_URI;

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return {
      client: cachedClient,
      db: cachedDb,
      usersCollection: cachedDb.collection("users"),
      scholarshipsCollection: cachedDb.collection("scholarships"),
      applicationsCollection: cachedDb.collection("applications"),
      reviewsCollection: cachedDb.collection("reviews"),
    };
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();

  const db = client.db(process.env.DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return {
    client,
    db,
    usersCollection: db.collection("users"),
    scholarshipsCollection: db.collection("scholarships"),
    applicationsCollection: db.collection("applications"),
    reviewsCollection: db.collection("reviews"),
  };
}

app.get("/", (req, res) => {
  res.send("Hello Scholars");
});

app.post("/api/jwt", async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });

  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ success: true });
});

app.post("/api/logout", async (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ success: true });
});

app.get("/api/users/:email", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = await connectToDatabase();
    const email = req.params.email;
    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    res.status(500).send({ message: "Error fetching user", error: error.message });
  }
});

app.post("/api/users/register", async (req, res) => {
  try {
    const { usersCollection } = await connectToDatabase();
    const user = req.body;
    const existingUser = await usersCollection.findOne({ email: user.email });

    if (existingUser) {
      return res.send({
        message: "User already exists",
        insertedId: existingUser._id,
      });
    }

    const result = await usersCollection.insertOne(user);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error registering user", error: error.message });
  }
});

app.get("/api/users", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = await connectToDatabase();
    const verifyAdmin = require("./middlewares/verifyAdmin")(usersCollection);

    verifyAdmin(req, res, async () => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
  } catch (error) {
    res.status(500).send({ message: "Error fetching users", error: error.message });
  }
});

app.patch("/api/users/:email/role", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = await connectToDatabase();
    const verifyAdmin = require("./middlewares/verifyAdmin")(usersCollection);

    verifyAdmin(req, res, async () => {
      const email = req.params.email;
      const { role } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        { $set: { role } }
      );

      res.send(result);
    });
  } catch (error) {
    res.status(500).send({ message: "Error updating user role", error: error.message });
  }
});

app.delete("/api/users/:email", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = await connectToDatabase();
    const verifyAdmin = require("./middlewares/verifyAdmin")(usersCollection);

    verifyAdmin(req, res, async () => {
      const email = req.params.email;
      const result = await usersCollection.deleteOne({ email });
      res.send(result);
    });
  } catch (error) {
    res.status(500).send({ message: "Error deleting user", error: error.message });
  }
});

app.get("/api/scholarships", async (req, res) => {
  try {
    const { scholarshipsCollection } = await connectToDatabase();
    const {
      search,
      country,
      category,
      sort,
      page = 1,
      limit = 9,
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { scholarshipName: { $regex: search, $options: "i" } },
        { universityName: { $regex: search, $options: "i" } },
        { degree: { $regex: search, $options: "i" } },
      ];
    }

    if (country) {
      query.universityCountry = country;
    }

    if (category) {
      query.scholarshipCategory = category;
    }

    let sortOptions = {};
    if (sort === "fees-asc") {
      sortOptions = { applicationFees: 1 };
    } else if (sort === "fees-desc") {
      sortOptions = { applicationFees: -1 };
    } else if (sort === "date-desc") {
      sortOptions = { scholarshipPostDate: -1 };
    } else if (sort === "date-asc") {
      sortOptions = { scholarshipPostDate: 1 };
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const scholarships = await scholarshipsCollection
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber)
      .toArray();

    const total = await scholarshipsCollection.countDocuments(query);

    res.send({
      scholarships,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      total,
    });
  } catch (error) {
    res.status(500).send({ message: "Error fetching scholarships", error: error.message });
  }
});

app.get("/api/scholarships/:id", async (req, res) => {
  try {
    const { scholarshipsCollection } = await connectToDatabase();
    const id = req.params.id;
    const scholarship = await scholarshipsCollection.findOne({
      _id: new ObjectId(id),
    });
    res.send(scholarship);
  } catch (error) {
    res.status(500).send({ message: "Error fetching scholarship", error: error.message });
  }
});

app.post("/api/scholarships", verifyToken, async (req, res) => {
  try {
    const { scholarshipsCollection, usersCollection } = await connectToDatabase();
    const verifyAdmin = require("./middlewares/verifyAdmin")(usersCollection);

    verifyAdmin(req, res, async () => {
      const scholarship = req.body;
      const result = await scholarshipsCollection.insertOne(scholarship);
      res.send(result);
    });
  } catch (error) {
    res.status(500).send({ message: "Error creating scholarship", error: error.message });
  }
});

app.put("/api/scholarships/:id", verifyToken, async (req, res) => {
  try {
    const { scholarshipsCollection, usersCollection } = await connectToDatabase();
    const verifyAdmin = require("./middlewares/verifyAdmin")(usersCollection);

    verifyAdmin(req, res, async () => {
      const id = req.params.id;
      const requestData = req.body;

      const allowedFields = [
        "scholarshipName",
        "universityName",
        "universityCountry",
        "universityCity",
        "universityImage",
        "subjectCategory",
        "scholarshipCategory",
        "degree",
        "applicationFees",
        "serviceCharge",
        "applicationDeadline",
        "scholarshipDescription",
        "scholarshipPostDate",
      ];

      const updateData = {};
      allowedFields.forEach((field) => {
        if (requestData[field] !== undefined) {
          updateData[field] = requestData[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        return res.status(400).send({ message: "No valid fields to update" });
      }

      const result = await scholarshipsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Scholarship not found" });
      }

      res.send({ message: "Scholarship updated successfully", result });
    });
  } catch (error) {
    res.status(500).send({
      message: "Error updating scholarship",
      error: error.message,
    });
  }
});

app.delete("/api/scholarships/:id", verifyToken, async (req, res) => {
  try {
    const { scholarshipsCollection, usersCollection } = await connectToDatabase();
    const verifyAdmin = require("./middlewares/verifyAdmin")(usersCollection);

    verifyAdmin(req, res, async () => {
      const id = req.params.id;
      const result = await scholarshipsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
  } catch (error) {
    res.status(500).send({ message: "Error deleting scholarship", error: error.message });
  }
});

app.get("/api/admin/scholarships", verifyToken, async (req, res) => {
  try {
    const { scholarshipsCollection, usersCollection } = await connectToDatabase();
    const verifyAdmin = require("./middlewares/verifyAdmin")(usersCollection);

    verifyAdmin(req, res, async () => {
      const scholarships = await scholarshipsCollection.find().toArray();
      res.send(scholarships);
    });
  } catch (error) {
    res.status(500).send({ message: "Error fetching admin scholarships", error: error.message });
  }
});

app.get("/api/applications", verifyToken, async (req, res) => {
  try {
    const { applicationsCollection, usersCollection } = await connectToDatabase();
    const verifyModerator = require("./middlewares/verifyModerator")(usersCollection);

    verifyModerator(req, res, async () => {
      const applications = await applicationsCollection.find().toArray();
      res.send(applications);
    });
  } catch (error) {
    res.status(500).send({ message: "Error fetching applications", error: error.message });
  }
});

app.get("/api/applications/user/:email", verifyToken, async (req, res) => {
  try {
    const { applicationsCollection } = await connectToDatabase();
    const email = req.params.email;
    const tokenEmail = req.user.email;

    if (email !== tokenEmail) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const applications = await applicationsCollection
      .find({ userEmail: email })
      .toArray();
    res.send(applications);
  } catch (error) {
    res.status(500).send({ message: "Error fetching user applications", error: error.message });
  }
});

app.post("/api/applications", verifyToken, async (req, res) => {
  try {
    const { applicationsCollection } = await connectToDatabase();
    const application = req.body;
    const result = await applicationsCollection.insertOne(application);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error creating application", error: error.message });
  }
});

app.patch("/api/applications/:id/status", verifyToken, async (req, res) => {
  try {
    const { applicationsCollection, usersCollection } = await connectToDatabase();
    const verifyModerator = require("./middlewares/verifyModerator")(usersCollection);

    verifyModerator(req, res, async () => {
      const id = req.params.id;
      const { applicationStatus } = req.body;

      const result = await applicationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { applicationStatus } }
      );

      res.send(result);
    });
  } catch (error) {
    res.status(500).send({ message: "Error updating application status", error: error.message });
  }
});

app.patch("/api/applications/:id/feedback", verifyToken, async (req, res) => {
  try {
    const { applicationsCollection, usersCollection } = await connectToDatabase();
    const verifyModerator = require("./middlewares/verifyModerator")(usersCollection);

    verifyModerator(req, res, async () => {
      const id = req.params.id;
      const { feedback } = req.body;

      const result = await applicationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { feedback } }
      );

      res.send(result);
    });
  } catch (error) {
    res.status(500).send({ message: "Error updating application feedback", error: error.message });
  }
});

app.patch("/api/applications/:id/payment", verifyToken, async (req, res) => {
  try {
    const { applicationsCollection } = await connectToDatabase();
    const id = req.params.id;
    const { paymentStatus } = req.body;

    const result = await applicationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { paymentStatus } }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error updating payment status", error: error.message });
  }
});

app.delete("/api/applications/:id", verifyToken, async (req, res) => {
  try {
    const { applicationsCollection } = await connectToDatabase();
    const id = req.params.id;
    const result = await applicationsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error deleting application", error: error.message });
  }
});

app.get("/api/reviews/scholarship/:id", async (req, res) => {
  try {
    const { reviewsCollection } = await connectToDatabase();
    const scholarshipId = req.params.id;
    const reviews = await reviewsCollection.find({ scholarshipId }).toArray();
    res.send(reviews);
  } catch (error) {
    res.status(500).send({ message: "Error fetching reviews", error: error.message });
  }
});

app.get("/api/reviews/user/:email", verifyToken, async (req, res) => {
  try {
    const { reviewsCollection } = await connectToDatabase();
    const email = req.params.email;
    const reviews = await reviewsCollection.find({ userEmail: email }).toArray();
    res.send(reviews);
  } catch (error) {
    res.status(500).send({ message: "Error fetching user reviews", error: error.message });
  }
});

app.get("/api/reviews", verifyToken, async (req, res) => {
  try {
    const { reviewsCollection, usersCollection } = await connectToDatabase();
    const verifyModerator = require("./middlewares/verifyModerator")(usersCollection);

    verifyModerator(req, res, async () => {
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews);
    });
  } catch (error) {
    res.status(500).send({ message: "Error fetching reviews", error: error.message });
  }
});

app.post("/api/reviews", verifyToken, async (req, res) => {
  try {
    const { reviewsCollection } = await connectToDatabase();
    const review = req.body;
    const result = await reviewsCollection.insertOne(review);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error creating review", error: error.message });
  }
});

app.patch("/api/reviews/:id", verifyToken, async (req, res) => {
  try {
    const { reviewsCollection } = await connectToDatabase();
    const id = req.params.id;
    const { ratingPoint, reviewComment } = req.body;

    const result = await reviewsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ratingPoint, reviewComment } }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error updating review", error: error.message });
  }
});

app.delete("/api/reviews/:id", verifyToken, async (req, res) => {
  try {
    const { reviewsCollection } = await connectToDatabase();
    const id = req.params.id;
    const result = await reviewsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error deleting review", error: error.message });
  }
});

app.post("/api/create-payment-intent", verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
