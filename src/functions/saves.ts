import { z } from "zod";
import database, { supabase } from "@/lib/config";
import { APIResponse } from "./types";
import utils from "@/lib/utils";

export interface AddSaveParams {
  url: string;
  accessToken: string;
}

export interface GetAllSavesParams {
  accessToken: string;
  archived?: boolean;
  page?: number;
  limit?: number;
}

export interface GetSaveByIdParams {
  id: string;
  accessToken: string;
}

export interface DeleteSaveParams {
  id: string;
  accessToken: string;
}

export interface ToggleArchiveParams {
  id: string;
  accessToken: string;
}

const saves = {
  addSave: async (params: AddSaveParams): Promise<APIResponse> => {
    try {
      const schema = z.object({
        url: z.string().url(),
        accessToken: z.string().min(1),
      });
      const validatedParams = schema.safeParse(params);
      if (!validatedParams.success)
        return {
          success: false,
          data: null,
          error: validatedParams.error.issues[0].message,
        };
      const { url, accessToken } = params;
      // Get current user from token
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }
      // Check if URL already exists for this user
      const existingSave = await database.save.findFirst({
        where: {
          url,
          userId: dbUser.id,
        },
      });
      if (existingSave) {
        return {
          success: false,
          data: null,
          error: "URL already saved",
        };
      }
      // Fetch and parse the URL
      const parsedContent = await utils.fetchAndParseUrl(url);
      // Create save record
      const save = await database.save.create({
        data: {
          title: parsedContent.title,
          url: parsedContent.url,
          content: parsedContent.content,
          excerpt: parsedContent.excerpt,
          imageUrl: parsedContent.imageUrl,
          userId: dbUser.id,
        },
      });
      return {
        success: true,
        data: {
          id: save.id,
          title: save.title,
          url: save.url,
          excerpt: save.excerpt,
          imageUrl: save.imageUrl,
          isArchived: save.isArchived,
          createdAt: save.createdAt,
        },
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || "Failed to save URL",
      };
    }
  },
  getAllSaves: async (params: GetAllSavesParams): Promise<APIResponse> => {
    try {
      const schema = z.object({
        accessToken: z.string().min(1),
        archived: z.boolean().optional(),
        page: z.number().optional(),
        limit: z.number().optional(),
      });
      const validatedParams = schema.safeParse(params);
      if (!validatedParams.success)
        return {
          success: false,
          data: null,
          error: validatedParams.error.issues[0].message,
        };
      const { accessToken, archived, page = 1, limit = 20 } = params;
      // Get current user from token
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }
      const offset = (page - 1) * limit;
      // Build where clause
      const where: any = { userId: dbUser.id };
      if (archived !== undefined) {
        where.isArchived = archived;
      }
      // Get saves with pagination
      const saves = await database.save.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          title: true,
          url: true,
          excerpt: true,
          imageUrl: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      // Get total count
      const total = await database.save.count({ where });
      return {
        success: true,
        data: {
          saves,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || "Failed to get saves",
      };
    }
  },
  getSaveById: async (params: GetSaveByIdParams): Promise<APIResponse> => {
    try {
      const schema = z.object({
        id: z.string().min(1),
        accessToken: z.string().min(1),
      });
      const validatedParams = schema.safeParse(params);
      if (!validatedParams.success)
        return {
          success: false,
          data: null,
          error: validatedParams.error.issues[0].message,
        };
      const { id, accessToken } = params;
      // Get current user from token
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }
      // Get save
      const save = await database.save.findFirst({
        where: {
          id,
          userId: dbUser.id,
        },
      });
      if (!save) {
        return {
          success: false,
          data: null,
          error: "Save not found",
        };
      }
      return {
        success: true,
        data: save,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || "Failed to get save",
      };
    }
  },
  deleteSave: async (params: DeleteSaveParams): Promise<APIResponse> => {
    try {
      const schema = z.object({
        id: z.string().min(1),
        accessToken: z.string().min(1),
      });
      const validatedParams = schema.safeParse(params);
      if (!validatedParams.success)
        return {
          success: false,
          data: null,
          error: validatedParams.error.issues[0].message,
        };
      const { id, accessToken } = params;
      // Get current user from token
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }
      // Delete save
      const save = await database.save.deleteMany({
        where: {
          id,
          userId: dbUser.id,
        },
      });
      if (save.count === 0) {
        return {
          success: false,
          data: null,
          error: "Save not found",
        };
      }
      return {
        success: true,
        data: { message: "Save deleted successfully" },
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || "Failed to delete save",
      };
    }
  },
  toggleArchive: async (params: ToggleArchiveParams): Promise<APIResponse> => {
    try {
      const schema = z.object({
        id: z.string().min(1),
        accessToken: z.string().min(1),
      });
      const validatedParams = schema.safeParse(params);
      if (!validatedParams.success)
        return {
          success: false,
          data: null,
          error: validatedParams.error.issues[0].message,
        };
      const { id, accessToken } = params;
      // Get current user from token
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }
      // Get current save
      const currentSave = await database.save.findFirst({
        where: {
          id,
          userId: dbUser.id,
        },
      });
      if (!currentSave) {
        return {
          success: false,
          data: null,
          error: "Save not found",
        };
      }
      // Toggle archive status
      const updatedSave = await database.save.update({
        where: { id },
        data: { isArchived: !currentSave.isArchived },
      });
      return {
        success: true,
        data: {
          id: updatedSave.id,
          title: updatedSave.title,
          url: updatedSave.url,
          isArchived: updatedSave.isArchived,
        },
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || "Failed to update archive status",
      };
    }
  },
};

export default saves;