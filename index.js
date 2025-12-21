const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = require('./middlewares/verifyToken');

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
    console.log("MongoDB Connected");

    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection("users");
    const scholarshipsCollection = db.collection("scholarships");
    const applicationsCollection = db.collection("applications");
    const reviewsCollection = db.collection("reviews");

    const verifyAdmin = require('./middlewares/verifyAdmin')(usersCollection);
    const verifyModerator = require('./middlewares/verifyModerator')(usersCollection);

    app.post('/api/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({ success: true });
    });

    app.post('/api/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({ success: true });
    });

    app.get("/api/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        
        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }
        
        res.send(user);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching user', error });
      }
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

    app.get("/api/users", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.patch("/api/users/:email/role", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const { role } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        { $set: { role } }
      );

      res.send(result);
    });

    app.delete("/api/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.deleteOne({ email });
      res.send(result);
    });

    app.get("/api/scholarships", async (req, res) => {
      try {
        const { search, country, category, sort, page = 1, limit = 9 } = req.query;
        
        const query = {};
        
        if (search) {
          query.$or = [
            { scholarshipName: { $regex: search, $options: 'i' } },
            { universityName: { $regex: search, $options: 'i' } },
            { degree: { $regex: search, $options: 'i' } }
          ];
        }
        
        if (country) {
          query.universityCountry = country;
        }
        
        if (category) {
          query.scholarshipCategory = category;
        }
        
        let sortOptions = {};
        if (sort === 'fees-asc') {
          sortOptions = { applicationFees: 1 };
        } else if (sort === 'fees-desc') {
          sortOptions = { applicationFees: -1 };
        } else if (sort === 'date-desc') {
          sortOptions = { scholarshipPostDate: -1 };
        } else if (sort === 'date-asc') {
          sortOptions = { scholarshipPostDate: 1 };
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const scholarships = await scholarshipsCollection
          .find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();
        
        const total = await scholarshipsCollection.countDocuments(query);
        
        res.send({
          scholarships,
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          total
        });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.get("/api/scholarships/:id", async (req, res) => {
      const id = req.params.id;
      const scholarship = await scholarshipsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(scholarship);
    });

    app.post("/api/scholarships", verifyToken, verifyAdmin, async (req, res) => {
      const scholarship = req.body;
      const result = await scholarshipsCollection.insertOne(scholarship);
      res.send(result);
    });

    app.put("/api/scholarships/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const requestData = req.body;
        
        const allowedFields = [
          'scholarshipName',
          'universityName',
          'universityCountry',
          'universityCity',
          'universityImage',
          'subjectCategory',
          'scholarshipCategory',
          'degree',
          'applicationFees',
          'serviceCharge',
          'applicationDeadline',
          'scholarshipDescription',
          'scholarshipPostDate'
        ];
        
        const updateData = {};
        allowedFields.forEach(field => {
          if (requestData[field] !== undefined) {
            updateData[field] = requestData[field];
          }
        });
        
        if (Object.keys(updateData).length === 0) {
          return res.status(400).send({ message: 'No valid fields to update' });
        }
        
        const result = await scholarshipsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Scholarship not found' });
        }
        
        res.send({ message: 'Scholarship updated successfully', result });
      } catch (error) {
        res.status(500).send({ message: 'Error updating scholarship', error: error.message });
      }
    });

    app.delete("/api/scholarships/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await scholarshipsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.get("/api/admin/scholarships", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const scholarships = await scholarshipsCollection.find().toArray();
        res.send(scholarships);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.get("/api/applications", verifyToken, verifyModerator, async (req, res) => {
      const applications = await applicationsCollection.find().toArray();
      res.send(applications);
    });

    app.get("/api/applications/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const tokenEmail = req.user.email;

      if (email !== tokenEmail) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const applications = await applicationsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(applications);
    });

    app.post("/api/applications", verifyToken, async (req, res) => {
      const application = req.body;
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    app.patch("/api/applications/:id/status", verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const { applicationStatus } = req.body;

      const result = await applicationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { applicationStatus } }
      );

      res.send(result);
    });

    app.patch("/api/applications/:id/feedback", verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;

      const result = await applicationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { feedback } }
      );

      res.send(result);
    });

    app.patch('/api/applications/:id/payment', verifyToken, async (req, res) => {
      const id = req.params.id;
      const { paymentStatus } = req.body;
      
      const result = await applicationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { paymentStatus } }
      );
      
      res.send(result);
    });

    app.delete('/api/applications/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await applicationsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get("/api/reviews/scholarship/:id", async (req, res) => {
      const scholarshipId = req.params.id;
      const reviews = await reviewsCollection
        .find({ scholarshipId })
        .toArray();
      res.send(reviews);
    });

    app.get("/api/reviews/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const reviews = await reviewsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(reviews);
    });

    app.get("/api/reviews", verifyToken, verifyModerator, async (req, res) => {
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews);
    });

    app.post("/api/reviews", verifyToken, async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    app.patch('/api/reviews/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const { ratingPoint, reviewComment } = req.body;
      
      const result = await reviewsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ratingPoint, reviewComment } }
      );
      
      res.send(result);
    });

    app.delete("/api/reviews/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await reviewsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.post('/api/create-payment-intent', verifyToken, async (req, res) => {
      const { amount } = req.body;
    
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
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

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Scholars");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
