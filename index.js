const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require('firebase-admin');

// Initialize Firebase Admin
let serviceAccount;
// Check if running in production (like on Vercel)
if (process.env.NODE_ENV === 'production') {
  // On Vercel, read from the environment variable
  serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
} else {
  // On local machine, read from the file
  serviceAccount = require('./firebase-service-account.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://nexus-living.web.app',
    'https://nexus-living.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());

// JWT Verification Middleware
const verifyToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.decoded = decodedToken;
    next();
  } catch (error) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
};

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
    await client.connect();

    const db = client.db('nexusLivingDB');
    const apartmentCollection = db.collection('apartments');
    const usersCollection = db.collection('users');
    const agreementsCollection = db.collection('agreements');
    const paymentsCollection = db.collection('payments');
    const announcementsCollection = db.collection('announcements');
    const couponsCollection = db.collection('coupons'); // Added coupons collection

    // Admin Verification Middleware
    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        next();
    };

    // API to save a new payment record
    app.post('/payments', verifyToken, async (req, res) => {
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
    app.get('/payments/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        // Security check: ensure the requester is asking for their own data
        if (req.decoded.email !== email) {
            return res.status(403).send({ message: 'forbidden access' });
        }
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
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
        try {
            const totalRooms = await apartmentCollection.countDocuments();
            const unavailableRooms = await agreementsCollection.countDocuments({ status: 'checked' });
            const totalUsers = await usersCollection.countDocuments();
            const totalMembers = await usersCollection.countDocuments({ role: 'member' });

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

    // Add: member/user overview stats
    app.get('/user-stats', verifyToken, async (req, res) => {
      try {
        const email = req.decoded?.email;

        const [myAgreements, myPayments, announces] = await Promise.all([
          agreementsCollection.countDocuments({ user_email: email }),
          paymentsCollection.countDocuments({ email }),
          announcementsCollection.countDocuments({}),
        ]);

        res.send({ myAgreements, myPayments, announcements: announces });
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch user stats', error });
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
        const result = await usersCollection.updateOne(query, updateDoc, options);
        res.send(result);
    });

    // API to get all coupons (for admin dashboard)
    app.get('/coupons', verifyToken, verifyAdmin, async (req, res) => {
        try {
            const result = await couponsCollection.find().sort({ createdAt: -1 }).toArray();
            res.send(result);
        } catch (error) {
            console.error('Failed to fetch coupons:', error);
            res.status(500).send({ message: 'Failed to fetch coupons' });
        }
    });

    // API to create a new coupon
    app.post('/coupons', verifyToken, verifyAdmin, async (req, res) => {
        const couponData = req.body;
        const newCoupon = {
            ...couponData,
            availability: 'available'
        };
        const result = await couponsCollection.insertOne(newCoupon);
        res.send(result);
    });

    // API to toggle coupon availability
    app.patch('/coupons/toggle/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const coupon = await couponsCollection.findOne(filter);

        if (!coupon) {
            return res.status(404).send({ message: 'Coupon not found.' });
        }

        const newAvailability = coupon.availability === 'available' ? 'unavailable' : 'available';
        const updateDoc = {
            $set: { availability: newAvailability },
        };
        const result = await couponsCollection.updateOne(filter, updateDoc);
        res.send(result);
    });

    // API to get a specific member's accepted agreement
    app.get('/agreement/:email', verifyToken, async (req, res) => {
        try {
          const email = req.params.email;
          if (req.decoded?.email !== email) return res.status(403).send({ message: 'forbidden access' });
          const agreement = await agreementsCollection.findOne({ user_email: email, status: 'accepted' });
          res.send(agreement);
        } catch (e) {
          console.error('GET /agreement/:email', e);
          res.status(500).send({ message: 'Failed to load agreement' });
        }
      });

    // API to validate a coupon code
    app.get('/coupons/:code', async (req, res) => {
        const code = req.params.code;
        // Only find the coupon if it is available
        const query = { code: code, availability: 'available' };
        const result = await couponsCollection.findOne(query);
        res.send(result); // Will send null if not found or unavailable
    });

    // --- All routes below are now protected by verifyToken and verifyAdmin ---

    // API to get all members
    app.get('/users/members', verifyToken, verifyAdmin, async (req, res) => {
        const query = { role: 'member' };
        const members = await usersCollection.find(query).toArray();
        res.send(members);
    });

    // API to update a member's role to 'user'
    app.patch('/users/member/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                role: 'user'
            }
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });

    // API to check if a user is an admin
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        const user = await usersCollection.findOne({ email: email });
        res.send({ admin: user?.role === 'admin' });
    });

    // API to check if a user is a member
    app.get('/users/member/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        const user = await usersCollection.findOne({ email: email });
        res.send({ member: user?.role === 'member' });
    });

    // API to get all apartments with pagination and search
    app.get('/apartments', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 0;
        const size = parseInt(req.query.size) || 6;

        const minRent = req.query.minRent;
        const maxRent = req.query.maxRent;

        const sortBy = req.query.sortBy || 'rent';
        const sortOrder = (req.query.sortOrder || 'asc').toLowerCase() === 'desc' ? -1 : 1;

        const query = {};
        // Rent filter only if both present and numeric
        if (minRent !== '' && maxRent !== '' && !isNaN(minRent) && !isNaN(maxRent)) {
          query.rent = { $gte: parseInt(minRent), $lte: parseInt(maxRent) };
        }

        // Whitelist sort fields
        const allowedSort = new Set(['rent', 'floor_no', 'block_name', 'apartment_no', '_id', 'createdAt']);
        const sortField = allowedSort.has(sortBy) ? sortBy : 'rent';
        const sort = { [sortField]: sortOrder };

        const total = await apartmentCollection.countDocuments(query);
        const apartments = await apartmentCollection
          .find(query)
          .sort(sort)
          .skip(page * size)
          .limit(size)
          .toArray();

        res.send({ count: total, apartments });
      } catch (e) {
        console.error(e);
        res.status(500).send({ message: 'Failed to fetch apartments' });
      }
    });

    // API to get all announcements
    app.get('/announcements', async (req, res) => {
      const result = await announcementsCollection.find().sort({ date: -1 }).toArray();
      res.send(result);
    });

    // API to create a new announcement
    app.post('/announcements', verifyToken, verifyAdmin, async (req, res) => {
      const announcementData = req.body;
      const newAnnouncement = {
        ...announcementData,
        date: new Date(),
        type: 'info'
      };
      const result = await announcementsCollection.insertOne(newAnnouncement);
      res.send(result);
    });

    // API to get all pending agreement requests
    app.get('/agreements', verifyToken, verifyAdmin, async (req, res) => {
        const query = { status: 'pending' };
        const result = await agreementsCollection.find(query).toArray();
        res.send(result);
    });

    // API to accept an agreement
    app.patch('/agreements/accept/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const agreementFilter = { _id: new ObjectId(id) };

        const agreement = await agreementsCollection.findOne(agreementFilter);
        if (!agreement) {
            return res.status(404).send({ message: 'Agreement not found.' });
        }

        // Update user's role to 'member'
        const userFilter = { email: agreement.user_email };
        const userUpdateDoc = { $set: { role: 'member' } };
        await usersCollection.updateOne(userFilter, userUpdateDoc);

        // Update agreement status and set accept date
        const agreementUpdateDoc = { $set: { status: 'checked', agreement_date: new Date() } };
        const result = await agreementsCollection.updateOne(agreementFilter, agreementUpdateDoc);
        res.send(result);
    });

    // API to reject an agreement
    app.patch('/agreements/reject/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { status: 'rejected' } };
        const result = await agreementsCollection.updateOne(filter, updateDoc);
        res.send(result);
    });

    // API to create a new agreement
    app.post('/agreements', verifyToken, async (req, res) => {
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
    app.get('/agreements/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const query = { user_email: email };
      const result = await agreementsCollection.findOne(query);
      res.send(result);
    });

    // Get user profile by email (secured)
    app.get('/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.decoded?.email !== email) return res.status(403).send({ message: 'forbidden access' });
      const profile = await usersCollection.findOne({ email }, { projection: { _id: 0, email: 1, phone: 1, address: 1 } });
      res.send(profile || { email });
    });

    // Update user profile (phone, address) with upsert
    app.put('/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.decoded?.email !== email) return res.status(403).send({ message: 'forbidden access' });
      const { phone, address } = req.body || {};
      const result = await usersCollection.updateOne(
        { email },
        { $set: { email, phone: phone || '', address: address || '' } },
        { upsert: true }
      );
      res.send(result);
    });

    // API to get my payments (newly added)
    app.get('/payments/me', verifyToken, async (req, res) => {
      try {
        const email = req.decoded?.email;
        const payments = await paymentsCollection
          .find({ email })
          .sort({ payment_date: -1 })
          .toArray();
        res.send(payments);
      } catch (e) {
        console.error('GET /payments/me', e);
        res.status(500).send({ message: 'Failed to load payments' });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close(); // Keep this commented out for a continuously running server
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('A12 BMS Server is running');
});

// Only listen on a port when running locally
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`BMS Server is running on port: ${port}`);
  });
}

module.exports = app;