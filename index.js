const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");

    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection("users");
    const scholarshipsCollection = db.collection("scholarships");
    const applicationsCollection = db.collection("applications");
    const reviewsCollection = db.collection("reviews");

    app.get("/api/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user || { role: "Student" });
    });

    app.post("/api/users/register", async (req, res) => {
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
    });

    app.get("/api/scholarships", async (req, res) => {
      const scholarships = await scholarshipsCollection.find().toArray();
      res.send(scholarships);
    });

    app.get("/api/scholarships/:id", async (req, res) => {
      const id = req.params.id;
      const scholarship = await scholarshipsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(scholarship);
    });

    app.post("/api/scholarships", async (req, res) => {
      const scholarship = req.body;
      const result = await scholarshipsCollection.insertOne(scholarship);
      res.send(result);
    });

    app.get("/api/applications", async (req, res) => {
      const applications = await applicationsCollection.find().toArray();
      res.send(applications);
    });

    app.get("/api/applications/user/:email", async (req, res) => {
      const email = req.params.email;
      const applications = await applicationsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(applications);
    });

    app.post("/api/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    app.get("/api/reviews/scholarship/:id", async (req, res) => {
      const scholarshipId = req.params.id;
      const reviews = await reviewsCollection.find({ scholarshipId }).toArray();
      res.send(reviews);
    });

    app.post("/api/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });


    app.get('/api/users', async (req, res) => {
        const users = await usersCollection.find().toArray();
        res.send(users);
      });
      
      app.patch('/api/users/:email/role', async (req, res) => {
        const email = req.params.email;
        const { role } = req.body;
        
        const result = await usersCollection.updateOne(
          { email },
          { $set: { role } }
        );
        
        res.send(result);
      });
      
      app.delete('/api/users/:email', async (req, res) => {
        const email = req.params.email;
        const result = await usersCollection.deleteOne({ email });
        res.send(result);
      });
      

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Scholars");
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
