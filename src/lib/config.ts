
import { PrismaClient } from "@/generated/prisma";
import { createClient } from "@supabase/supabase-js";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const database = globalThis.prismaGlobal ?? prismaClientSingleton();
if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = database;

export default database;


export const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY  || ''
);

export const config = {
  apiKey: process.env.API_KEY as string,
  supabaseUrl: process.env.SUPABASE_URL as string,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY as string,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY as string,
  databaseUrl: process.env.DATABASE_URL as string,
  resendApiKey: process.env.RESEND_API_KEY as string,
};
