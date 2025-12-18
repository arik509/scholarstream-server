const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
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
    const scholarshipsCollection = db.collection('scholarships');


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


    app.get('/api/scholarships', async (req, res) => {
        const scholarships = await scholarshipsCollection.find().toArray();
        res.send(scholarships);
      });

      app.post('/api/scholarships', async (req, res) => {
        const scholarship = req.body;
        const result = await scholarshipsCollection.insertOne(scholarship);
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
