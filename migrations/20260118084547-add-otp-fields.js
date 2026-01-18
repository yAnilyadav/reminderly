// migrations/20250118000003-add-otp-fields.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add OTP columns
    await queryInterface.addColumn('doctors', 'otp_code', {
      type: Sequelize.STRING(6),
      allowNull: true
    });

    await queryInterface.addColumn('doctors', 'otp_expires', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('doctors', 'otp_attempts', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    // Remove old token columns (if they exist)
    try {
      await queryInterface.removeColumn('doctors', 'verification_token');
      await queryInterface.removeColumn('doctors', 'verification_token_expires');
    } catch (error) {
      console.log('Old token columns not found or already removed');
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('doctors', 'otp_code');
    await queryInterface.removeColumn('doctors', 'otp_expires');
    await queryInterface.removeColumn('doctors', 'otp_attempts');
  }
};