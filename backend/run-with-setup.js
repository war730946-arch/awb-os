require('dotenv').config();
process.env.DATABASE_URL = '';

const { app, PORT } = require('./api/server');
const db = require('./database');

async function setup() {
  if (db.init) await db.init();
  
  // Create admin user if not exists
  let user;
  try {
    user = await db.createUser('admin@awb-os.com', require('crypto').createHash('sha256').update('Admin@123456').digest('hex'), 'Admin');
    console.log('Created admin user');
  } catch (e) {
    user = await db.getUserByEmail('admin@awb-os.com');
    console.log('Admin user exists');
  }

  // Create business if not exists
  let businesses = await db.getBusinessesByUserId(user.id);
  if (businesses.length === 0) {
    const biz = await db.createBusiness(user.id, 'My Business', 'general', '923281146929');
    console.log('Created business:', biz.id);
  } else {
    console.log('Business exists:', businesses[0].id);
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
