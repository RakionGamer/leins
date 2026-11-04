"use strict";

const { REFRESH_TOKEN_USER_TABLE, RefreshTokenUserSchema } = require("../db/models/refresh-token-user.model");

module.exports = {
   async up(queryInterface) {
      const tableDesc = await queryInterface.describeTable(REFRESH_TOKEN_USER_TABLE).catch(() => null);
      if (!tableDesc) {
         await queryInterface.createTable(REFRESH_TOKEN_USER_TABLE, RefreshTokenUserSchema);
         await queryInterface.addIndex(REFRESH_TOKEN_USER_TABLE, ["user_id", "revoked_at"]).catch(() => {});
         await queryInterface.addIndex(REFRESH_TOKEN_USER_TABLE, ["expires_at"]).catch(() => {});
      }
   },

   async down(queryInterface) {
      await queryInterface.dropTable(REFRESH_TOKEN_USER_TABLE).catch(() => {});
   },
};
