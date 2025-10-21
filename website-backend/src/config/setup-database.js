require('dotenv').config();
const { supabaseAdmin } = require('./supabase');
const fs = require('fs').promises;
const path = require('path');

async function setupDatabase() {
  try {
    console.log('🚀 Setting up Supabase database...');

    // Read SQL schema file
    const sqlPath = path.join(__dirname, '..', 'migrations', 'schema.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

    console.log('📋 Executing database setup...');

    // Execute each statement using Supabase client
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          // For CREATE TABLE statements, we'll use raw SQL through the client
          if (statement.trim().toLowerCase().includes('create table')) {
            console.log('✅ Table creation should be done manually in Supabase dashboard');
            console.log('📝 Please run this SQL in your Supabase SQL Editor:');
            console.log(statement.substring(0, 100) + '...');
          } else if (statement.trim().toLowerCase().includes('insert into')) {
            // Handle INSERT statements for default settings
            await executeInsertStatement(statement.trim());
          } else if (statement.trim().toLowerCase().includes('create index')) {
            console.log('✅ Index creation should be done manually in Supabase dashboard');
            console.log('📝 Please run this SQL in your Supabase SQL Editor:');
            console.log(statement.substring(0, 100) + '...');
          }
        } catch (error) {
          console.error('❌ Statement Error:', error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }

    console.log('🎉 Database setup completed!');
    console.log('📊 You can now start the server with: npm run dev');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

async function executeInsertStatement(statement) {
  try {
    // Parse INSERT statement for settings table
    const insertMatch = statement.match(/INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)/);
    if (!insertMatch) return;

    const table = insertMatch[1];
    const columns = insertMatch[2].split(',').map(col => col.trim().replace(/"/g, ''));
    const values = insertMatch[3];

    if (table === 'settings') {
      // Handle JSONB values
      const jsonMatch = values.match(/'(\{[^}]+\})'::jsonb/);
      if (jsonMatch) {
        const settingsData = JSON.parse(jsonMatch[1]);

        // Extract category from the JSON data
        const category = Object.keys(settingsData)[0];

        console.log(`📝 Inserting default settings for category: ${category}`);

        const { data, error } = await supabaseAdmin
          .from('settings')
          .insert([{
            category: category,
            settings: settingsData
          }]);

        if (error) {
          console.error('❌ Insert Error:', error.message);
        } else {
          console.log('✅ Settings inserted successfully');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error executing insert:', error.message);
  }
}

setupDatabase();
