// scripts/createSuperuser.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createSuperuser() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.DBURI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if superuser already exists
    const existingSuperuser = await User.findOne({ 
      role: 'super_admin',
      email: process.env.SUPERUSER_EMAIL || 'admin@thefinalplay.com'
    });

    if (existingSuperuser) {
      console.log('❌ Superuser already exists:', existingSuperuser.email);
      process.exit(1);
    }

    // Create superuser data
    const superuserData = {
      email: process.env.SUPERUSER_EMAIL || 'admin@thefinalplay.com',
      password: process.env.SUPERUSER_PASSWORD || 'AdminPass123!',
      first_name: 'Super',
      surname: 'Admin',
      display_name: 'Super Admin',
      role: 'super_admin',
      is_active: true,
      is_verified: true,
      terms_accepted_at: new Date(),
      privacy_policy_accepted_at: new Date()
    };

    console.log('Creating superuser with email:', superuserData.email);
    
    // Create the superuser
    const superuser = await User.create(superuserData);
    
    console.log('✅ Superuser created successfully!');
    console.log('📧 Email:', superuser.email);
    console.log('👤 Name:', superuser.first_name, superuser.surname);
    console.log('🔑 Role:', superuser.role);
    console.log('');
    console.log('🚨 IMPORTANT: Please save these credentials securely!');
    console.log('📧 Email:', superuserData.email);
    console.log('🔐 Password:', superuserData.password);
    console.log('');
    console.log('You can now use these credentials to log into the admin panel.');

  } catch (error) {
    console.error('❌ Error creating superuser:', error);
    if (error.code === 11000) {
      console.error('Email already exists in database');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  console.log('🛠️  Creating superuser account...');
  createSuperuser();
}

module.exports = createSuperuser;