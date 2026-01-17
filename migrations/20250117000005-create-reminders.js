// migrations/20250117000005-create-reminders.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reminders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      doctor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'doctors',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      doctor_patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'doctor_patients',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      visit_id: {
        type: Sequelize.UUID,
        references: {
          model: 'visits',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      channel: {
        type: Sequelize.ENUM('sms', 'whatsapp'),
        allowNull: false
      },
      scheduled_for: {
        type: Sequelize.DATE,
        allowNull: false
      },
      sent_at: {
        type: Sequelize.DATE
      },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'failed'),
        defaultValue: 'pending',
        allowNull: false
      },
      failure_reason: {
        type: Sequelize.TEXT
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('reminders');
  }
};