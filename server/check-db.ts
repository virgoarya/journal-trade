import mongoose from 'mongoose';

mongoose.connect('mongodb://127.0.0.1:27017/journal-trade-db').then(async () => {
  const db = mongoose.connection.db;
  const aiSkills = await db.collection('aibacktestskills').find().toArray();
  console.log(JSON.stringify(aiSkills, null, 2));
  process.exit(0);
});
