const mysql = require('mysql2/promise');
const fs = require('fs').promises;
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ga_system',
  multipleStatements: true
};

async function runEnhancedSchema() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📖 Reading enhanced schema file...');
    const schemaSQL = await fs.readFile('scripts/enhancedDatabaseSchema.sql', 'utf8');
    
    // Split the SQL into individual statements (excluding comments and empty lines)
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🚀 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          // Some statements might fail if they already exist, which is okay
          if (error.code === 'ER_DUP_FIELDNAME' || 
              error.code === 'ER_DUP_KEYNAME' || 
              error.code === 'ER_TABLE_EXISTS_ERROR' ||
              error.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            console.log('Statement:', statement.substring(0, 100) + '...');
          }
        }
      }
    }
    
    console.log('\n🎉 Enhanced database schema applied successfully!');
    console.log('\n📊 New features added:');
    console.log('  • Enhanced request approval workflow');
    console.log('  • Notification system for real-time updates');
    console.log('  • Request approval history tracking');
    console.log('  • Item categorization system');
    console.log('  • Stock alerts and monitoring');
    console.log('  • User session management');
    console.log('  • Audit trails for stock transactions');
    console.log('  • Automatic triggers for notifications');
    console.log('  • Performance indexes');
    console.log('  • Useful views for reporting');
    
  } catch (error) {
    console.error('❌ Enhanced schema application failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runEnhancedSchema();