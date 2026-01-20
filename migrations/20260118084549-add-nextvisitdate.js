// migrations/20250118000009-add-next-scheduled-visit.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('doctor_patients', 'next_scheduled_visit', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });

    console.log('✅ Added next_scheduled_visit to doctor_patients table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('doctor_patients', 'next_scheduled_visit');
  }
};