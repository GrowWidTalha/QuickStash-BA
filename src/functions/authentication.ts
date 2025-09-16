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

            return {
                success: true,
                data: {
                    user: dbUser,
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
    login: async (params: LoginParams): Promise<APIResponse> => {
        try {
            console.log("~ 🚀: Login - validating supabaseUserId", params);
        
            // 1. Validate input
            const loginSchema = z.object({
              supabaseUserId: z.string().uuid(),
            });
        
            const validated = loginSchema.safeParse(params);
            if (!validated.success) {
              return {
                success: false,
                data: null,
                error: validated.error.issues[0].message,
              };
            }
        
            const { supabaseUserId } = validated.data;
        
            // 2. Check if user exists in your own DB
            let user = await database.user.findUnique({
              where: { supabaseUserId },
            });
        
            if (user) {
              console.log("~ ✅: User found in DB", user.id);
              return {
                success: true,
                data: { user },
                error: null,
              };
            }
        
            // 3. If user doesn't exist in DB, fetch from Supabase
            const { data: supabaseUserData, error: supabaseError } = await supabase.auth.admin.getUserById(supabaseUserId);
        
            if (supabaseError || !supabaseUserData?.user) {
              console.error("~ ❌: Error fetching Supabase user", supabaseError?.message);
              return {
                success: false,
                data: null,
                error: supabaseError?.message || "Supabase user not found",
              };
            }
        
            const supabaseUser = supabaseUserData.user;
        
            // 4. Create new user in your DB using Supabase data
            user = await database.user.create({
              data: {
                supabaseUserId: supabaseUser.id,
                email: supabaseUser.email || "", // fallback to empty string
                // name: supabaseUser.user_metadata?.full_name || "New User",
                avatarUrl: supabaseUser.user_metadata?.avatar_url || `https://api.dicebear.com/9.x/glass/svg?seed=${supabaseUser.email?.split("@")[0]}`,
              },
            });
        
            console.log("~ ✅: New user created in DB", user.id);
        
            return {
              success: true,
              data: { user },
              error: null,
            };
          } catch (error: any) {
            console.error("~ 🚨: Login - unexpected error", error);
            return {
              success: false,
              data: null,
              error: error.message || "Unknown server error",
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