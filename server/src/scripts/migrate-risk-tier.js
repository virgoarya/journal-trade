const mongoose = require('mongoose');

// Load models
require('../models/TradingAccount.js');

const migrate = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/journal-trade';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const accounts = await mongoose.model('TradingAccount').find({
      $or: [
        { riskTier: { $exists: false } },
        { riskTier: null }
      ]
    });

    console.log(`Found ${accounts.length} accounts to migrate`);

    for (const account of accounts) {
      account.riskTier = 'MODERATE';
      account.riskNotificationEnabled = true;
      await account.save();
      console.log(`✓ Updated account ${account._id} (${account.accountName})`);
    }

    console.log('🎉 Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
