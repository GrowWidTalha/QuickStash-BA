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
            console.log("~ 🚀: Register - validating params", params);
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
            console.log("~ 🚀: Register - checking if user exists in Supabase Auth", email);
            const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
            if (authError) {
                console.log("~ 🚀: Register - error listing users", authError);
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
                console.log("~ 🚀: Register - user already exists in Supabase Auth", foundUser.id);
                // User exists in Supabase Auth
                supabaseUserId = foundUser.id;
            } else {
                // User does not exist, create in Supabase Auth
                console.log("~ 🚀: Register - creating user in Supabase Auth", email);
                const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                });
                if (createError || !createdUser || !createdUser.user) {
                    console.log("~ 🚀: Register - error creating user in Supabase Auth", createError);
                    return {
                        success: false,
                        data: null,
                        error: createError?.message || "Failed to create user in Supabase Auth",
                    };
                }
                supabaseUserId = createdUser.user.id;
            }

            // 2. Create user in your database
            console.log("~ 🚀: Register - creating user in DB", supabaseUserId);
            const dbUser = await database.user.create({
                data: {
                    email,
                    avatarUrl: DEFAULT_AVATAR_URL,
                    supabaseUserId,
                },
            });

            // 3. Sign in to get tokens
            console.log("~ 🚀: Register - signing in to get tokens", email);
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
                console.log("~ 🚀: Register - received tokens", { access_token, refresh_token, expires_in, token_type });
            } else {
                console.log("~ 🚀: Register - failed to get tokens", signInError);
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
            console.log("~ 🚀: Register - error", error);
            return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
    login: async (params:  LoginParams): Promise<APIResponse> => {
        try {
            console.log("~ 🚀: Login - validating params", params);
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

            console.log("~ 🚀: Login - signing in with Supabase", email);
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });

              if(authError){
                console.log("~ 🚀: Login - error signing in", authError);
                return {
                    success: false,
                    data: null,
                    error: authError.message,
                };
              }

              console.log("~ 🚀: Login - finding user in DB", authData.user.id);
              const user = await database.user.findUnique({
                where: { supabaseUserId: authData.user.id },
              });
          
              if (!user) {
                console.log("~ 🚀: Login - user not found in DB");
                return {
                    success: false,
                    data: null,
                    error: "User not found",
                }
              }

              const session = authData.session;
              console.log("~ 🚀: Login - session info", session);
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
            console.log("~ 🚀: Login - error", error);
             return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
    getCurrentUser: async (params: GetCurrentUserParams): Promise<APIResponse> => {
        try {
            console.log("~ 🚀: GetCurrentUser - validating params", params);
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
            console.log("~ 🚀: GetCurrentUser - getting user from Supabase", accessToken);
            const { data: { user }, error } = await supabase.auth.getUser(accessToken);
            if (error || !user) {
                console.log("~ 🚀: GetCurrentUser - error or user not found", error);
                return {
                    success: false,
                    data: null,
                    error: error?.message || "User not found",
                };
            }
            console.log("~ 🚀: GetCurrentUser - finding user in DB", user.id);
            const dbUser = await database.user.findUnique({
                where: { supabaseUserId: user.id },
            });
            if (!dbUser) {
                console.log("~ 🚀: GetCurrentUser - user not found in DB");
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
            console.log("~ 🚀: GetCurrentUser - error", error);
            return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
    resetPassword: async (params: ResetPasswordParams): Promise<APIResponse> => {
        try {
            console.log("~ 🚀: ResetPassword - validating params", params);
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
            console.log("~ 🚀: ResetPassword - sending reset email", email);
            const { data, error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) {
                console.log("~ 🚀: ResetPassword - error sending reset email", error);
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
            console.log("~ 🚀: ResetPassword - error", error);
            return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
    refreshToken: async (params: { refresh_token: string }): Promise<APIResponse> => {
        try {
            console.log("~ 🚀: RefreshToken - validating params", params);
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
            console.log("~ 🚀: RefreshToken - refreshing session with Supabase", refresh_token);
            const { data: sessionData, error } = await supabase.auth.refreshSession({ refresh_token });
            if (error || !sessionData.session) {
                console.log("~ 🚀: RefreshToken - error refreshing session", error);
                return {
                    success: false,
                    data: null,
                    error: error?.message || "Failed to refresh session",
                };
            }
            const session = sessionData.session;
            const { user } = sessionData;
            if (!user) {
                console.log("~ 🚀: RefreshToken - user is null after refresh");
                return {
                    success: false,
                    data: null,
                    error: "User not found",
                };
            }
            console.log("~ 🚀: RefreshToken - finding user in DB", user.id);
            const dbUser = await database.user.findUnique({
                where: { supabaseUserId: user.id },
            });
            if (!dbUser) {
                console.log("~ 🚀: RefreshToken - user not found in DB");
                return {
                    success: false,
                    data: null,
                    error: "User not found",
                };
            }
            console.log("~ 🚀: RefreshToken - returning refreshed tokens");
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
            console.log("~ 🚀: RefreshToken - error", error);
            return {
                success: false,
                data: null,
                error: error.message || "Unknown error",
            };
        }
    },
}

export default authentication