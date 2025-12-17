// prisma.config.ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // seed: 'tsx prisma/seed.ts',  // Uncomment and adjust if you have a seed script
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})