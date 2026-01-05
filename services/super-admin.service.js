const boom = require('@hapi/boom');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize')
const { models } = require('./../libs/sequelize');

class SuperAdminService {
   constructor() { }

   // lista admins con paginacion
   async find(query) {
      const { limit, offset, search, excludeId } = query;

      const options = {
         attributes: { exclude: ['password_hash', 'two_factor_secret'] },
         where: {},
         order: [['id', 'DESC']]
      };

      if (limit !== undefined && offset !== undefined) {
         options.limit = parseInt(limit);
         options.offset = parseInt(offset);
      }

      if (search) {
         options.where = {
            [Op.or]: [
               { username: { [Op.like]: `%${search}%` } },
               { email: { [Op.like]: `%${search}%` } },
               { name: { [Op.like]: `%${search}%` } },
               { last_name: { [Op.like]: `%${search}%` } }
            ]
         };
      }

      // excluye a quien esta consultando
      if (excludeId) {
         options.where.id = { [Op.ne]: excludeId };
      }

      const { count, rows } = await models.SuperAdmin.findAndCountAll(options);
      return { total: count, items: rows };
   }

   // Cambiar estado (Activar/Bloquear)
   async changeState(id, stateId) {
      const admin = await this.findOne(id);

      // Aquí actualizamos solo el campo state_id
      await admin.update({ state_id: stateId });

      return {
         id: admin.id,
         state_id: stateId,
         message: 'Estado de usuario actualizado correctamente'
      };
   }

   // buscar un admin por ID
   async findOne(id) {
      const admin = await models.SuperAdmin.findByPk(id, {
         attributes: { exclude: ['password_hash', 'two_factor_secret'] }
      });
      if (!admin) {
         throw boom.notFound('Administrador no encontrado');
      }
      return admin;
   }

   // Actualizar datos del perfil (Permite name, last_name, phone)
   async update(id, changes) {
      const admin = await this.findOne(id);

      // Filtramos campos sensibles para que no se puedan inyectar por aquí
      const { password, password_hash, username, id: _id, ...allowedChanges } = changes;

      const updatedAdmin = await admin.update(allowedChanges);

      // Retornamos sin hash
      const rta = updatedAdmin.toJSON();
      delete rta.password_hash;
      return rta;
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

   // cambiar contraseña (Estando logueado)
   async changePassword(id, oldPassword, newPassword) {
      // 1. Buscamos al usuario con su hash para comparar
      const admin = await models.SuperAdmin.findByPk(id);
      if (!admin) throw boom.notFound('Usuario no encontrado');

      // 2. Verificamos la contraseña actual
      const isMatch = await bcrypt.compare(oldPassword, admin.password_hash);
      if (!isMatch) {
         throw boom.unauthorized('La contraseña actual es incorrecta');
      }

      // 3. Hasheamos la nueva y guardamos
      const hash = await bcrypt.hash(newPassword, 10);
      await admin.update({ password_hash: hash });

      return { message: 'Contraseña actualizada correctamente' };
   }

   // elimina un usuario
   async delete(id) {
      const admin = await this.findOne(id);
      await admin.update({ state_id: 3 });
      console.log('paso');
      await admin.destroy();
      return { id };
   }

}

module.exports = SuperAdminService;