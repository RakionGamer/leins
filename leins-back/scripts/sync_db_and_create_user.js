require('dotenv').config();
const bcrypt = require('bcryptjs'); // Package installed as seen in package.json
const { models, sequelize } = require('../db/models');

async function main() {
   try {
      console.log('Synchronizing models with database...');
      // Sync models without dropping them
      await sequelize.sync({ alter: true });
      console.log('Sync complete.');

      const email = 'blackrvalera@gmail.com';
      const plainPassword = '12345678910';
      
      console.log(`Checking if state exists...`);
      let state = await models.State.findOne({ where: { name: 'active' } });
      if (!state) {
          state = await models.State.create({ name: 'active', description: 'Active state' });
      }

      console.log(`Checking if user ${email} already exists...`);
      let user = await models.SuperAdmin.findOne({ where: { email } });

      if (user) {
         console.log(`User ${email} already exists! Updating password...`);
         const hash = await bcrypt.hash(plainPassword, 10);
         user.password_hash = hash;
         await user.save();
         console.log('Password updated successfully.');
      } else {
         console.log(`Creating user ${email}...`);
         const hash = await bcrypt.hash(plainPassword, 10);
         user = await models.SuperAdmin.create({
            username: email,
            email: email,
            password_hash: hash,
            state_id: state.id,
            verified: true,
         });
         console.log('User created successfully!');
      }

   } catch (error) {
      console.error('Error in script:', error);
   } finally {
      process.exit();
   }
}

main();
