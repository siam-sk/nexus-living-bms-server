const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
    const announcementCollection = client.db('nexusLivingDB').collection('announcements');
    const userCollection = client.db('nexusLivingDB').collection('users');
    const couponsCollection = client.db('nexusLivingDB').collection('coupons');
    const paymentsCollection = client.db('nexusLivingDB').collection('payments');

    // API to save a new payment record
    app.post('/payments', async (req, res) => {
        const paymentDetails = req.body;
        const paymentRecord = {
            ...paymentDetails,
            payment_date: new Date(),
            transaction_id: `txn_${new Date().getTime()}`
        };
        const result = await paymentsCollection.insertOne(paymentRecord);
        res.send(result);
    });

    // API to get payment history for a specific user, with search by month
    app.get('/payments/:email', async (req, res) => {
        const email = req.params.email;
        const searchMonth = req.query.month;

        const query = { email: email };
        if (searchMonth) {
            // Case-insensitive search for the month
            query.month = { $regex: `^${searchMonth}$`, $options: 'i' };
        }

        const result = await paymentsCollection.find(query).sort({ payment_date: -1 }).toArray();
        res.send(result);
    });

    // API to get admin statistics
    app.get('/admin-stats', async (req, res) => {
        try {
            const totalRooms = await apartmentCollection.countDocuments();
            const unavailableRooms = await agreementsCollection.countDocuments({ status: 'checked' });
            const totalUsers = await userCollection.countDocuments();
            const totalMembers = await userCollection.countDocuments({ role: 'member' });

            const availableRooms = totalRooms - unavailableRooms;

            const availablePercentage = totalRooms > 0 ? (availableRooms / totalRooms) * 100 : 0;
            const unavailablePercentage = totalRooms > 0 ? (unavailableRooms / totalRooms) * 100 : 0;

            res.send({
                totalRooms,
                availablePercentage: availablePercentage.toFixed(2),
                unavailablePercentage: unavailablePercentage.toFixed(2),
                totalUsers,
                totalMembers,
            });
        } catch (error) {
            res.status(500).send({ message: 'Failed to fetch admin stats', error });
        }
    });

    // API to create or update a user (upsert)
    app.put('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email };
        // Set default role to 'user' only on insert
        const updateDoc = {
            $set: user,
            $setOnInsert: { role: 'user' }
        };
        const options = { upsert: true };
        const result = await userCollection.updateOne(query, updateDoc, options);
        res.send(result);
    });

    // API to get all coupons
    app.get('/coupons', async (req, res) => {
        const result = await couponsCollection.find().toArray();
        res.send(result);
    });

    // API to create a new coupon
    app.post('/coupons', async (req, res) => {
        const couponData = req.body;
        const result = await couponsCollection.insertOne(couponData);
        res.send(result);
    });

    // API to get a specific member's accepted agreement
    app.get('/agreement/:email', async (req, res) => {
        const email = req.params.email;
        const query = { user_email: email, status: 'checked' };
        const result = await agreementsCollection.findOne(query);
        res.send(result);
    });

    // API to validate a coupon code
    app.get('/coupons/:code', async (req, res) => {
        const code = req.params.code;
        const query = { coupon_code: code };
        const result = await couponsCollection.findOne(query);
        res.send(result);
    });

    // API to get all members
    app.get('/users/members', async (req, res) => {
        const query = { role: 'member' };
        const members = await userCollection.find(query).toArray();
        res.send(members);
    });

    // API to update a member's role to 'user'
    app.patch('/users/member/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                role: 'user'
            }
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });

    // API to check if a user is an admin
    app.get('/users/admin/:email', async (req, res) => {
        const email = req.params.email;
        const user = await userCollection.findOne({ email: email });
        res.send({ admin: user?.role === 'admin' });
    });

    // API to check if a user is a member
    app.get('/users/member/:email', async (req, res) => {
        const email = req.params.email;
        const user = await userCollection.findOne({ email: email });
        res.send({ member: user?.role === 'member' });
    });

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

    // API to get all announcements
    app.get('/announcements', async (req, res) => {
      const result = await announcementCollection.find().sort({ date: -1 }).toArray();
      res.send(result);
    });

    // API to create a new announcement
    app.post('/announcements', async (req, res) => {
        const announcementData = req.body;
        const newAnnouncement = {
            ...announcementData,
            date: new Date(), 
            type: 'info'      
        };
        const result = await announcementCollection.insertOne(newAnnouncement);
        res.send(result);
    });

    // API to get all pending agreement requests
    app.get('/agreements', async (req, res) => {
        const query = { status: 'pending' };
        const result = await agreementsCollection.find(query).toArray();
        res.send(result);
    });

    // API to accept an agreement
    app.patch('/agreements/accept/:id', async (req, res) => {
        const id = req.params.id;
        const agreementFilter = { _id: new ObjectId(id) };

        const agreement = await agreementsCollection.findOne(agreementFilter);
        if (!agreement) {
            return res.status(404).send({ message: 'Agreement not found.' });
        }

        // Update user's role to 'member'
        const userFilter = { email: agreement.user_email };
        const userUpdateDoc = { $set: { role: 'member' } };
        await userCollection.updateOne(userFilter, userUpdateDoc);

        // Update agreement status and set accept date
        const agreementUpdateDoc = { $set: { status: 'checked', agreement_date: new Date() } };
        const result = await agreementsCollection.updateOne(agreementFilter, agreementUpdateDoc);
        res.send(result);
    });

    // API to reject an agreement
    app.patch('/agreements/reject/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { status: 'checked' } };
        const result = await agreementsCollection.updateOne(filter, updateDoc);
        res.send(result);
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