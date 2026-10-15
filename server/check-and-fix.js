const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/hunter-trades';

async function main() {
  try {
    await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    console.log('--- Collections Check ---');
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    console.log('\n--- Searching Registrations ---');
    const allRegs = await db.collection('registrations').find({}).toArray();
    console.log('All Registrations Count:', allRegs.length);
    allRegs.forEach(r => console.log(JSON.stringify(r)));

    console.log('\n--- Searching Token Balances ---');
    const allTb = await db.collection('tokenbalances').find({}).toArray();
    console.log('All TokenBalances Count:', allTb.length);
    allTb.forEach(t => console.log(JSON.stringify(t)));

    console.log('\n--- Searching User ---');
    const allUsers = await db.collection('user').find({}).toArray();
    console.log('All Users Count:', allUsers.length);
    allUsers.forEach(u => console.log(JSON.stringify({ _id: u._id, id: u.id, email: u.email, name: u.name })));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
