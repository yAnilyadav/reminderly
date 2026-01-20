// migrations/20250118000012-add-reminder-count-to-patients.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('doctor_patients', 'reminder_count', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('doctor_patients', 'last_reminder_sent', {
      type: Sequelize.DATE,
      allowNull: true
    });

    console.log('✅ Added reminder_count and last_reminder_sent to doctor_patients');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('doctor_patients', 'last_reminder_sent');
    await queryInterface.removeColumn('doctor_patients', 'reminder_count');
  }
};