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

    // API to get all apartments
    app.get('/apartments', async (req, res) => {
      const result = await apartmentCollection.find().toArray();
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