import { z } from "zod"
import database, { supabase } from "@/lib/config"
import { APIResponse } from "./types"


export interface RegisterParams {
    email: string
    password: string
}
export interface LoginParams {
    email: string
    password: string
}

export interface GetCurrentUserParams {
    accessToken: string;
}

export interface ResetPasswordParams {
    email: string;
}

const authentication = {
    register: async (params: RegisterParams): Promise<APIResponse> => {
        try {
            const registerSchema = z.object({
                email: z.string().email(),
                password: z.string()
            })

            const validatedParams = registerSchema.safeParse(params);

            if (!validatedParams.success)
                return {
                    success: false,
                    data: null,
                    error: validatedParams.error.issues[0].message,
                };

            const email = params.email;
            const password = params.password;
            const DEFAULT_AVATAR_URL = `https://api.dicebear.com/9.x/glass/svg?seed=${params.email.split("@")[0]}`; // Update as needed

            // 1. Check if user exists in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
            if (authError) {
                return {
                    success: false,
                    data: null,
                    error: authError.message,
                };
            }

            let supabaseUserId: string;
            let session: any = null;
            let access_token: string | null = null;
            let refresh_token: string | null = null;
            let expires_in: number | null = null;
            let token_type: string | null = null;

            const foundUser = authData && authData.users
                ? authData.users.find((user: any) => user.email === email)
                : null;
            if (foundUser) {
                // User exists in Supabase Auth
                supabaseUserId = foundUser.id;
            } else {
                // User does not exist, create in Supabase Auth
                const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                });
                if (createError || !createdUser || !createdUser.user) {
                    return {
                        success: false,
                        data: null,
                        error: createError?.message || "Failed to create user in Supabase Auth",
                    };
                }
                supabaseUserId = createdUser.user.id;
            }

            // 2. Create user in your database
            const dbUser = await database.user.create({
                data: {
                    email,
                    avatarUrl: DEFAULT_AVATAR_URL,
                    supabaseUserId,
                },
            });

            // 3. Sign in to get tokens
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (!signInError && signInData && signInData.session) {
                session = signInData.session;
                access_token = session.access_token;
                refresh_token = session.refresh_token;
                expires_in = session.expires_in;
                token_type = session.token_type;
            }

            return {
                success: true,
                data: {
                    user: dbUser,
                    access_token,
                    refresh_token,
                    expires_in,
                    token_type,
                },
                error: null,
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
    login: async (params:  LoginParams): Promise<APIResponse> => {
        try {
            const loginSchema = z.object({
                email: z.string().email(),
                password: z.string()
            })

            const validatedParams = loginSchema.safeParse(params);

            if (!validatedParams.success)
                return {
                    success: false,
                    data: null,
                    error: validatedParams.error.issues[0].message,
                };

            const email = params.email;
            const password = params.password;

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if(authError){
                return {
                    success: false,
                    data: null,
                    error: authError.message,
                };
            }

            const user = await database.user.findUnique({
                where: { supabaseUserId: authData.user.id },
            });
        
            if (!user) {
                return {
                    success: false,
                    data: null,
                    error: "User not found",
                }
            }

            const session = authData.session;
            return {
                success: true,
                data: {
                    user,
                    access_token: session?.access_token,
                    refresh_token: session?.refresh_token,
                    expires_in: session?.expires_in,
                    token_type: session?.token_type,
                },
                error: null
            }
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
    getCurrentUser: async (params: GetCurrentUserParams): Promise<APIResponse> => {
        try {
            const schema = z.object({
                accessToken: z.string().min(1)
            });
            const validatedParams = schema.safeParse(params);
            if (!validatedParams.success)
                return {
                    success: false,
                    data: null,
                    error: validatedParams.error.issues[0].message,
                };
            const { accessToken } = params;
            const { data: { user }, error } = await supabase.auth.getUser(accessToken);
            if (error || !user) {
                return {
                    success: false,
                    data: null,
                    error: error?.message || "User not found",
                };
            }
            const dbUser = await database.user.findUnique({
                where: { supabaseUserId: user.id },
            });
            if (!dbUser) {
                return {
                    success: false,
                    data: null,
                    error: "User not found in database",
                };
            }
            return {
                success: true,
                data: dbUser,
                error: null,
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
    resetPassword: async (params: ResetPasswordParams): Promise<APIResponse> => {
        try {
            const schema = z.object({
                email: z.string().email()
            });
            const validatedParams = schema.safeParse(params);
            if (!validatedParams.success)
                return {
                    success: false,
                    data: null,
                    error: validatedParams.error.issues[0].message,
                };
            const { email } = params;
            const { data, error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) {
                return {
                    success: false,
                    data: null,
                    error: error.message,
                };
            }
            return {
                success: true,
                data,
                error: null,
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
    refreshToken: async (params: { refresh_token: string }): Promise<APIResponse> => {
        try {
            const schema = z.object({
                refresh_token: z.string().min(1)
            });
            const validatedParams = schema.safeParse(params);
            if (!validatedParams.success)
                return {
                    success: false,
                    data: null,
                    error: validatedParams.error.issues[0].message,
                };
            const { refresh_token } = params;
            const { data: sessionData, error } = await supabase.auth.refreshSession({ refresh_token });
            if (error || !sessionData.session) {
                return {
                    success: false,
                    data: null,
                    error: error?.message || "Failed to refresh session",
                };
            }
            const session = sessionData.session;
            const { user } = sessionData;
            // Find user in DB
            const dbUser = await database.user.findUnique({
                where: { supabaseUserId: user?.id },
            });
            if (!dbUser) {
                return {
                    success: false,
                    data: null,
                    error: "User not found",
                };
            }
            return {
                success: true,
                data: {
                    user: dbUser,
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                    expires_in: session.expires_in,
                    token_type: session.token_type,
                },
                error: null,
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
}

export default authentication