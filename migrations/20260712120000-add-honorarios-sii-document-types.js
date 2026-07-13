'use strict';

module.exports = {
   async up(queryInterface) {
      await queryInterface.bulkInsert('sii_document_types', [
         {
            code: 1001,
            slug: 'boleta-honorarios-emitida',
            name: 'Boleta de honorarios emitida',
            created_at: new Date(),
         },
         {
            code: 1002,
            slug: 'boleta-honorarios-recibida',
            name: 'Boleta de honorarios recibida',
            created_at: new Date(),
         },
      ], {
         updateOnDuplicate: ['slug', 'name'],
      });
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete('sii_document_types', {
         code: [1001, 1002],
      });
   },
};
