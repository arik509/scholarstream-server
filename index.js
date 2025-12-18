const express = require("express");
const cors = require("cors");
require('dotenv').config();

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
    console.log('✅ MongoDB Connected');

    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection('users');


    
    app.get('/', (req, res) => {
        res.send('ScholarStream API is running');
      });
  
      app.get('/api/users/:email', async (req, res) => {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        res.send(user || { role: 'Student' });
      });
  




    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Scholars");
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
