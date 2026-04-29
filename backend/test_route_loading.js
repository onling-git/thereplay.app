// Test if routes can be loaded without errors
console.log('Testing route loading...\n');

try {
  console.log('1. Loading syncRoutes.js...');
  const syncRoutes = require('./routes/syncRoutes');
  console.log('   ✅ syncRoutes loaded successfully');
  console.log(`   Type: ${typeof syncRoutes}`);
} catch (err) {
  console.error('   ❌ syncRoutes failed to load:');
  console.error(`   ${err.message}`);
  console.error(`   Stack: ${err.stack}`);
}

try {
  console.log('\n2. Loading syncController.js...');
  const syncController = require('./controllers/syncController');
  console.log('   ✅ syncController loaded successfully');
  console.log(`   Exported functions: ${Object.keys(syncController).join(', ')}`);
} catch (err) {
  console.error('   ❌ syncController failed to load:');
  console.error(`   ${err.message}`);
  console.error(`   Stack: ${err.stack}`);
}

try {
  console.log('\n3. Loading standingsRoutes.js...');
  const standingsRoutes = require('./routes/standingsRoutes');
  console.log('   ✅ standingsRoutes loaded successfully');
  console.log(`   Type: ${typeof standingsRoutes}`);
} catch (err) {
  console.error('   ❌ standingsRoutes failed to load:');
  console.error(`   ${err.message}`);
  console.error(`   Stack: ${err.stack}`);
}
