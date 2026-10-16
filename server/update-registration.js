const mongoose = require('mongoose');
const { env } = require('./dist/config/env');

async function updateRegistration() {
  try {
    await mongoose.connect(env.DATABASE_URL, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;
    
    // Delete old registrations with string user_id (from previous script attempts)
    const delResult = await db.collection('registrations').deleteMany({
      user_id: '6a26146a9cad211ba0631027'
    });
    console.log('Deleted old registrations:', delResult.deletedCount);

    // Insert with ObjectId
    const userId = '6a26146a9cad211ba0631027';
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    const result = await db.collection('registrations').updateOne(
      { user_id: userObjectId },
      { 
        $set: { 
          user_id: userObjectId,
          discord_id: userId,
          username: 'VTrades',
          email: 'virga@example.com',
          registration_status: 'active',
          registration_paid_at: new Date(),
          is_booster: false,
          plan: 'premium',
          is_lifetime: true,
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
    
    if (result.upsertedCount > 0) {
      console.log('✓ Registration created with ObjectId');
    } else {
      console.log('✓ Registration updated');
    }
    
    // Verify TokenBalance
    const tb = await db.collection('tokenbalances').findOne({ user_id: userObjectId });
    console.log('TokenBalance:', JSON.stringify(tb));
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

updateRegistration();
