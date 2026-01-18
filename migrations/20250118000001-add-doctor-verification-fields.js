// migrations/20250118000000-add-doctor-verification-columns.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add only the essential columns
    await queryInterface.addColumn('doctors', 'email_verified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('doctors', 'verification_token', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('doctors', 'verification_token_expires', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('doctors', 'is_active', {
      type: Sequelize.BOOLEAN,
      defaultValue: false, // Set existing doctors as active
      allowNull: false
    });

    
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('doctors', 'email_verified');
    await queryInterface.removeColumn('doctors', 'verification_token');
    await queryInterface.removeColumn('doctors', 'verification_token_expires');
    await queryInterface.removeColumn('doctors', 'is_active');
  }
};