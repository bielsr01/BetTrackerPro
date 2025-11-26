import { Pool } from 'pg';

export interface MigrationResult {
  success: boolean;
  tables: {
    name: string;
    count: number;
    status: 'success' | 'error';
    error?: string;
  }[];
  totalRecords: number;
  error?: string;
}

export class MigrationService {
  private sourcePool: Pool;
  private targetPool: Pool | null = null;

  constructor() {
    this.sourcePool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  async migrate(supabaseUrl: string): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      tables: [],
      totalRecords: 0
    };

    try {
      this.targetPool = new Pool({ 
        connectionString: supabaseUrl,
        ssl: { rejectUnauthorized: false }
      });

      await this.targetPool.query('SELECT 1');
      console.log('[Migration] Connected to Supabase successfully');

      await this.createSchema();

      const tables = [
        { name: 'users', order: 1 },
        { name: 'account_holders', order: 2 },
        { name: 'betting_houses', order: 3 },
        { name: 'surebet_sets', order: 4 },
        { name: 'bets', order: 5 },
        { name: 'session', order: 6 }
      ];

      for (const table of tables) {
        try {
          const count = await this.migrateTable(table.name);
          result.tables.push({ name: table.name, count, status: 'success' });
          result.totalRecords += count;
          console.log(`[Migration] ${table.name}: ${count} records migrated`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.tables.push({ name: table.name, count: 0, status: 'error', error: errorMsg });
          console.error(`[Migration] Error migrating ${table.name}:`, errorMsg);
        }
      }

      result.success = result.tables.every(t => t.status === 'success');
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Migration] Fatal error:', result.error);
      return result;
    } finally {
      if (this.targetPool) {
        await this.targetPool.end();
      }
    }
  }

  private async createSchema(): Promise<void> {
    if (!this.targetPool) throw new Error('Target pool not initialized');

    const schemaSQL = `
      DROP TABLE IF EXISTS session CASCADE;
      DROP TABLE IF EXISTS bets CASCADE;
      DROP TABLE IF EXISTS surebet_sets CASCADE;
      DROP TABLE IF EXISTS betting_houses CASCADE;
      DROP TABLE IF EXISTS account_holders CASCADE;
      DROP TABLE IF EXISTS users CASCADE;

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS account_holders (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        name TEXT NOT NULL,
        email TEXT,
        username TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS betting_houses (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        name TEXT NOT NULL,
        notes TEXT,
        account_holder_id VARCHAR REFERENCES account_holders(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS surebet_sets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        event_date TIMESTAMP,
        sport TEXT,
        league TEXT,
        team_a TEXT,
        team_b TEXT,
        profit_percentage DECIMAL(5,2),
        status TEXT DEFAULT 'pending',
        is_checked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        surebet_set_id VARCHAR REFERENCES surebet_sets(id),
        betting_house_id VARCHAR REFERENCES betting_houses(id),
        bet_type TEXT NOT NULL,
        odd DECIMAL(8,3) NOT NULL,
        stake DECIMAL(10,2) NOT NULL,
        potential_profit DECIMAL(10,2) NOT NULL,
        result TEXT,
        actual_profit DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
      CREATE INDEX IF NOT EXISTS idx_bets_surebet_set ON bets(surebet_set_id);
      CREATE INDEX IF NOT EXISTS idx_surebet_sets_user ON surebet_sets(user_id);
      CREATE INDEX IF NOT EXISTS idx_betting_houses_user ON betting_houses(user_id);
      CREATE INDEX IF NOT EXISTS idx_account_holders_user ON account_holders(user_id);
    `;

    await this.targetPool.query(schemaSQL);
    console.log('[Migration] Schema created successfully');
  }

  private async migrateTable(tableName: string): Promise<number> {
    if (!this.targetPool) throw new Error('Target pool not initialized');

    const sourceData = await this.sourcePool.query(`SELECT * FROM ${tableName}`);
    
    if (sourceData.rows.length === 0) {
      return 0;
    }

    const columns = Object.keys(sourceData.rows[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.join(', ');

    for (const row of sourceData.rows) {
      const values = columns.map(col => row[col]);
      
      try {
        await this.targetPool.query(
          `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
      } catch (error) {
        console.error(`[Migration] Error inserting into ${tableName}:`, error);
        throw error;
      }
    }

    return sourceData.rows.length;
  }

  async testConnection(supabaseUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const pool = new Pool({ 
        connectionString: supabaseUrl,
        ssl: { rejectUnauthorized: false }
      });
      
      await pool.query('SELECT 1');
      await pool.end();
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }
}
