// src/services/super-admin.service.js
const boom = require('@hapi/boom');
const bcrypt = require('bcrypt');
const { models } = require('../libs/sequelize');

class SuperAdminService {
   constructor() { }

   // lista todos los super admins
   async find() {
      try {
         const { count, rows } = await models.SuperAdmin.findAndCountAll();
         return { total: count, items: rows };
      } catch (error) {
         console.error('Error in find():', error);
         throw boom.badImplementation('Failed to fetch super admins from the database');
      }
   }

   // busca un super admin por id
   async findOne(id) {
      try {
         const superAdmin = await models.SuperAdmin.findByPk(id);
         if (!superAdmin) {
            throw boom.notFound('super admin not found');
         }
         return superAdmin;
      } catch (error) {
         console.error('Error in findOne():', error);
         if (boom.isBoom(error)) throw error;
         throw boom.badImplementation('Failed to fetch the super admin');
      }
   }

   // actualiza el tema del super admin
   async updateTheme(superAdminId, theme) {
      const superAdmin = await this.findOne(superAdminId);
      if (!superAdmin) return null;

      superAdmin.theme = theme;
      await superAdmin.save();

      return superAdmin;
   }

   // crea un super admin
   async create(payload) {
      const {
         username,
         email,
         password,
         state_id,
         name,
         last_name,
         phone,
         avatar_url,
         theme,
         verified,
         two_factor_enabled,
      } = payload;

      // validaciones básicas
      if (!username || !email || !password) {
         throw boom.badRequest('username, email y password son obligatorios');
      }

      // state_id requerido por el modelo; usa default 1 si no viene
      const finalStateId = Number.isFinite(Number(state_id)) ? Number(state_id) : 1;

      // check duplicados
      const exists = await models.SuperAdmin.findOne({
         where: { email }
      });
      if (exists) {
         throw boom.conflict('ya existe un super admin con ese email');
      }
      const existsUser = await models.SuperAdmin.findOne({
         where: { username }
      });
      if (existsUser) {
         throw boom.conflict('ya existe un super admin con ese username');
      }

      // hash de contraseña
      const password_hash = await bcrypt.hash(password, 10);

      // crea registro
      const created = await models.SuperAdmin.create({
         username,
         email,
         password_hash,
         state_id: finalStateId,
         name: name ?? null,
         last_name: last_name ?? null,
         phone: phone ?? null,
         avatar_url: avatar_url ?? null,
         theme: theme ?? null,
         verified: typeof verified === 'boolean' ? verified : false,
         two_factor_enabled: typeof two_factor_enabled === 'boolean' ? two_factor_enabled : false,
         last_login: null
      });

      // nunca retornar el hash
      const json = created.toJSON();
      delete json.password_hash;
      return json;
   }

}

module.exports = SuperAdminService;