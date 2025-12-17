const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ 
  adapter, // Pass the adapter here
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Initialize Prisma Client with proper configuration


// Handle database connection
async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function disconnectDB() {
  try {
    await prisma.$disconnect();
    console.log('👋 Database disconnected');
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
}

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
};
