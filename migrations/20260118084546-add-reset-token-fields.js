// migrations/[timestamp]-add-reset-token-fields.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('doctors', 'reset_token', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('doctors', 'reset_token_expires', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('doctors', 'reset_token');
    await queryInterface.removeColumn('doctors', 'reset_token_expires');
  }
};