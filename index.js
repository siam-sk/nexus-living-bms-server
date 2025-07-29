const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.elmkg1h.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    

    const apartmentCollection = client.db('nexusLivingDB').collection('apartments');
    const agreementsCollection = client.db('nexusLivingDB').collection('agreements');

    // API to get all apartments with pagination and search
    app.get('/apartments', async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const size = parseInt(req.query.size) || 6;
      const minRent = parseInt(req.query.minRent);
      const maxRent = parseInt(req.query.maxRent);
      const skip = page * size;

      const query = {};

      if (!isNaN(minRent) && !isNaN(maxRent)) {
        query.rent = { $gte: minRent, $lte: maxRent };
      } else if (!isNaN(minRent)) {
        query.rent = { $gte: minRent };
      } else if (!isNaN(maxRent)) {
        query.rent = { $lte: maxRent };
      }

      const count = await apartmentCollection.countDocuments(query);
      const apartments = await apartmentCollection.find(query).skip(skip).limit(size).toArray();
      
      res.send({
        count,
        apartments
      });
    });

    // API to create a new agreement
    app.post('/agreements', async (req, res) => {
      const agreement = req.body;

      // Check if user already has an agreement
      const existingAgreement = await agreementsCollection.findOne({ user_email: agreement.user_email });
      if (existingAgreement) {
          return res.status(400).send({ message: 'You have already requested an agreement.' });
      }

      const result = await agreementsCollection.insertOne(agreement);
      res.send(result);
    });

    // API to get a specific agreement by user email
    app.get('/agreements/:email', async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const result = await agreementsCollection.findOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } catch (err) {
    console.error(err);
  }
}
run();


app.get('/', (req, res) => {
  res.send('A12 BMS Server is running');
});

app.listen(port, () => {
  console.log(`BMS Server is running on port: ${port}`);
});