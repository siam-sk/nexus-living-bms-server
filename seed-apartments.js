require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.elmkg1h.mongodb.net/?retryWrites=true&w=majority`;

const data = [
  { image: 'https://images.pexels.com/photos/439391/pexels-photo-439391.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 2, block_name: 'A', apartment_no: 201, rent: 1150, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 3, block_name: 'A', apartment_no: 302, rent: 1280, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 5, block_name: 'B', apartment_no: 503, rent: 1490, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 7, block_name: 'B', apartment_no: 704, rent: 1650, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 8, block_name: 'C', apartment_no: 805, rent: 1720, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/259950/pexels-photo-259950.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 4, block_name: 'C', apartment_no: 408, rent: 1390, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 6, block_name: 'A', apartment_no: 605, rent: 1580, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/323705/pexels-photo-323705.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 9, block_name: 'B', apartment_no: 902, rent: 1790, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/1454806/pexels-photo-1454806.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 10, block_name: 'C', apartment_no: 1003, rent: 1890, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/279719/pexels-photo-279719.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 1, block_name: 'A', apartment_no: 103, rent: 1090, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/210265/pexels-photo-210265.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 2, block_name: 'B', apartment_no: 206, rent: 1190, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 3, block_name: 'C', apartment_no: 309, rent: 1295, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/210604/pexels-photo-210604.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 4, block_name: 'A', apartment_no: 410, rent: 1410, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/262405/pexels-photo-262405.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 5, block_name: 'B', apartment_no: 511, rent: 1520, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 6, block_name: 'C', apartment_no: 612, rent: 1600, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/37347/office-sitting-room-executive-sitting-room-37347.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 7, block_name: 'A', apartment_no: 713, rent: 1680, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/259687/pexels-photo-259687.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 8, block_name: 'B', apartment_no: 814, rent: 1740, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 9, block_name: 'C', apartment_no: 915, rent: 1820, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/259962/pexels-photo-259962.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 10, block_name: 'A', apartment_no: 1016, rent: 1950, available: true, createdAt: new Date() },
  { image: 'https://images.pexels.com/photos/439227/pexels-photo-439227.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1', floor_no: 11, block_name: 'B', apartment_no: 1117, rent: 2050, available: true, createdAt: new Date() },
];

(async () => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('nexusLivingDB');
    const col = db.collection('apartments');
    const result = await col.insertMany(data);
    console.log(`Inserted ${result.insertedCount} apartments.`);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
})();