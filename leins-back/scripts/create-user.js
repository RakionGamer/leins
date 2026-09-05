const bcrypt = require('bcryptjs');
const { sequelize, models } = require('../libs/sequelize');

async function createUser() {
   try {

      const email = 'blackrvalera@gmail.com';
      const username = email; // usamos el email como username si no hay otro
      const passwordPlain = '12345678910';

      const password_hash = await bcrypt.hash(passwordPlain, 10);

      const superAdmin = await models.SuperAdmin.create({
         username,
         email,
         password_hash,
         state_id: 1, // Asumimos que 1 es activo
         verified: true,
         name: 'Usuario',
         last_name: 'Prueba',
         two_factor_enabled: false
      });

      console.log('SuperAdmin creado con éxito:', superAdmin.id, superAdmin.email);
   } catch (error) {
      console.error('Error al crear usuario:', error);
   } finally {
      await sequelize.close();
   }
}

createUser();
