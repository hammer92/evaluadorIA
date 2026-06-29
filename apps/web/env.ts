import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
});

const serverEnvSchema = clientEnvSchema.extend({
  REPOSITORY_DRIVER: z.enum(['memory', 'firebase']).default('memory'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  FIREBASE_ADMIN_PROJECT_ID: z.string().optional(),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().optional(),
});

const parsedClient = clientEnvSchema.safeParse({
  NEXT_PUBLIC_APP_ENV: process.env['NEXT_PUBLIC_APP_ENV'],
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env['NEXT_PUBLIC_FIREBASE_API_KEY'],
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env['NEXT_PUBLIC_FIREBASE_APP_ID'],
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'],
  NEXT_PUBLIC_API_BASE_URL: process.env['NEXT_PUBLIC_API_BASE_URL'],
});

if (!parsedClient.success) {
  throw new Error(
    'Invalid client env: ' + JSON.stringify(parsedClient.error.flatten().fieldErrors, null, 2),
  );
}

export const clientEnv = parsedClient.data;
export const env =
  typeof window === 'undefined'
    ? serverEnvSchema.parse({ ...parsedClient.data, ...process.env })
    : (parsedClient.data as unknown as z.infer<typeof serverEnvSchema>);
