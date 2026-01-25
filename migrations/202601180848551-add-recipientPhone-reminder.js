// migrations/XXXXXXXXXXXXXX-add-recipient-phone-to-reminders.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Add only recipient_phone column
      await queryInterface.addColumn('reminders', 'recipient_phone', {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Phone number the message was sent to'
      }, { transaction });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('reminders', 'recipient_phone', { transaction });
    });
  }
};