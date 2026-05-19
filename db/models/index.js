// models/index.js — setupModels() sin 'manager', usando nombres exactos del SQL

const { State, StateSchema } = require('./state.model');
const { UserType, UserTypeSchema } = require('./user-type.model');
const { SuperAdmin, SuperAdminSchema } = require('./super-admin.model');
const { Admin, AdminSchema } = require('./admin.model');
const { User, UserSchema } = require('./user.model');
const { Entity, EntitySchema } = require('./entity.model');
const { AdminEntity, AdminEntitySchema } = require('./admin-entity.model');
const { UserEntity, UserEntitySchema } = require('./user-entity.model');
const { EntityModule, EntityModuleSchema } = require('./entity-module.model');
const { Credential, CredentialSchema } = require('./credential.model');
const { EntityBankAccount, EntityBankAccountSchema } = require('./entity-bank-account.model');
const { EntitySiiDocument, EntitySiiDocumentSchema } = require('./entity-sii-document.model');
const { EntityBankTransaction, EntityBankTransactionSchema } = require('./entity-bank-transaction.model');
const { BankTransactionDocument, BankTransactionDocumentSchema } = require('./bank-transaction-document.model');
const { EntityCashFlowProjection, EntityCashFlowProjectionSchema } = require('./entity-cash-flow-projection.model');
const { RefreshTokenSuperAdmin, RefreshTokenSuperAdminSchema } = require('./refresh-token-super-admin.model');
const { ActivityLog, ActivityLogSchema } = require('./activity-log.model');
const { LoginLog, LoginLogSchema } = require('./login-log.model');
const { ErrorLog, ErrorLogSchema } = require('./error-log.model');
const { SiiDocumentType, SiiDocumentTypeSchema } = require('./sii-document-type.model');
const { Notification, NotificationSchema } = require('./notification.model');
const { SiiSyncJob, SiiSyncJobSchema } = require('./sii-sync-job.model');

function setupModels(sequelize) {
   // 1) init
   State.init(StateSchema, State.config(sequelize));
   UserType.init(UserTypeSchema, UserType.config(sequelize));
   SuperAdmin.init(SuperAdminSchema, SuperAdmin.config(sequelize));
   Admin.init(AdminSchema, Admin.config(sequelize));
   User.init(UserSchema, User.config(sequelize));
   Entity.init(EntitySchema, Entity.config(sequelize));
   AdminEntity.init(AdminEntitySchema, AdminEntity.config(sequelize));
   UserEntity.init(UserEntitySchema, UserEntity.config(sequelize));
   EntityModule.init(EntityModuleSchema, EntityModule.config(sequelize));
   Credential.init(CredentialSchema, Credential.config(sequelize));
   EntityBankAccount.init(EntityBankAccountSchema, EntityBankAccount.config(sequelize));
   EntitySiiDocument.init(EntitySiiDocumentSchema, EntitySiiDocument.config(sequelize));
   EntityBankTransaction.init(EntityBankTransactionSchema, EntityBankTransaction.config(sequelize));
   BankTransactionDocument.init(BankTransactionDocumentSchema, BankTransactionDocument.config(sequelize));
   EntityCashFlowProjection.init(EntityCashFlowProjectionSchema, EntityCashFlowProjection.config(sequelize));
   RefreshTokenSuperAdmin.init(RefreshTokenSuperAdminSchema, RefreshTokenSuperAdmin.config(sequelize));
   ActivityLog.init(ActivityLogSchema, ActivityLog.config(sequelize));
   LoginLog.init(LoginLogSchema, LoginLog.config(sequelize));
   ErrorLog.init(ErrorLogSchema, ErrorLog.config(sequelize));
   SiiDocumentType.init(SiiDocumentTypeSchema, SiiDocumentType.config(sequelize));
   Notification.init(NotificationSchema, Notification.config(sequelize));
   SiiSyncJob.init(SiiSyncJobSchema, SiiSyncJob.config(sequelize));

   // 2) associate
   if (State.associate) State.associate(sequelize.models);
   if (UserType.associate) UserType.associate(sequelize.models);
   if (SuperAdmin.associate) SuperAdmin.associate(sequelize.models);
   if (Admin.associate) Admin.associate(sequelize.models);
   if (User.associate) User.associate(sequelize.models);
   if (Entity.associate) Entity.associate(sequelize.models);
   if (AdminEntity.associate) AdminEntity.associate(sequelize.models);
   if (UserEntity.associate) UserEntity.associate(sequelize.models);
   if (EntityModule.associate) EntityModule.associate(sequelize.models);
   if (Credential.associate) Credential.associate(sequelize.models);
   if (EntityBankAccount.associate) EntityBankAccount.associate(sequelize.models);
   if (EntitySiiDocument.associate) EntitySiiDocument.associate(sequelize.models);
   if (EntityBankTransaction.associate) EntityBankTransaction.associate(sequelize.models);
   if (BankTransactionDocument.associate) BankTransactionDocument.associate(sequelize.models);
   if (EntityCashFlowProjection.associate) EntityCashFlowProjection.associate(sequelize.models);
   if (RefreshTokenSuperAdmin.associate) RefreshTokenSuperAdmin.associate(sequelize.models);
   if (ActivityLog.associate) ActivityLog.associate(sequelize.models);
   if (LoginLog.associate) LoginLog.associate(sequelize.models);
   if (ErrorLog.associate) ErrorLog.associate(sequelize.models);
   if (SiiDocumentType.associate) SiiDocumentType.associate(sequelize.models);
   if (SiiSyncJob.associate) SiiSyncJob.associate(sequelize.models);
}

module.exports = setupModels;
