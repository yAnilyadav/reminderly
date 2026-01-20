// migrations/20250118000004-add-patient-details.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    

    await queryInterface.addColumn('doctor_patients', 'gender', {
      type: Sequelize.ENUM('male', 'female', 'other'),
      allowNull: true
    });

    await queryInterface.addColumn('doctor_patients', 'age', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('doctor_patients', 'address', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('doctor_patients', 'is_active', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });

    await queryInterface.addColumn('visits', 'diagnosis', {
        type: Sequelize.TEXT,
        allowNull: true
      });

    console.log('✅ Successfully added new fields to doctor_patients table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('doctor_patients', 'is_active');
    await queryInterface.removeColumn('doctor_patients', 'address');
    await queryInterface.removeColumn('doctor_patients', 'age');
    await queryInterface.removeColumn('doctor_patients', 'gender');
    await queryInterface.removeColumn('visits', 'diagnosis');
  }
};