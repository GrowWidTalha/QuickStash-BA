import { z } from "zod";
import database, { supabase } from "@/lib/config";
import { APIResponse } from "./types";
import utils from "@/lib/utils";

export interface AddSaveParams {
  url: string;
  accessToken: string;
  title?: string; // Made optional
  excerpt?: string; // Made optional
  favicon_url?: string; // New field
  featured_image_url: string;
  isFetchingAllowed?: boolean;
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

export interface UpdateSaveParams {
  id: string;
  accessToken: string;
  title?: string;
  excerpt?: string;
  favicon_url?: string;
  featured_image_url?: string;
  isRead?: boolean;
  isArchived?: boolean;
}


const saves = {
  addSave: async (params: AddSaveParams): Promise<APIResponse> => {
    try {
      console.log("~ 🚀: addSave - validating params", params);
      const schema = z.object({
        url: z.string().url(),
        accessToken: z.string().min(1),
        title: z.string().optional(),
        excerpt: z.string().optional(),
        featured_image_url: z.string().optional(),
        favicon_url: z.string().optional(),
        isFetchingAllowed: z.boolean().optional(),
      });
      const validatedParams = schema.safeParse(params);
      if (!validatedParams.success)
        return {
          success: false,
          data: null,
          error: validatedParams.error.issues[0].message,
        };
      let { url, accessToken, title, excerpt, favicon_url, featured_image_url, isFetchingAllowed } = params;
      if(!title && !excerpt && !favicon_url && !featured_image_url && !isFetchingAllowed){
        console.log("~ 🚀: addSave - fetching metadata on the backend")
        const parseRes = await fetch(process.env.NEXT_PUBLIC_SERVER_URL + '/api/parse-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
        });
        const {data} = await parseRes.json();
        console.log({data})
        title = data.title
        favicon_url = data.favicon_url
        excerpt = data.excerpt
        featured_image_url = data.featured_image_url
        url = data.final_url
        isFetchingAllowed = data.isFetchingAllowed
      }
      // Get current user from token
      console.log("~ 🚀: addSave - getting user from token", accessToken);
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        console.log("~ 🚀: addSave - invalid token or user not found", authError);
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      console.log("~ 🚀: addSave - finding user in DB", user.id);
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        console.log("~ 🚀: addSave - user not found in DB");
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }
      // Check if URL already exists for this user
      console.log("~ 🚀: addSave - checking if URL already saved", url);
      const existingSave = await database.save.findFirst({
        where: {
          url,
          userId: dbUser.id,
        },
      });
      if (existingSave) {
        console.log("~ 🚀: addSave - URL already saved");
        return {
          success: false,
          data: null,
          error: "URL already saved",
        };
      }
      // Create save record
      console.log("~ 🚀: addSave - creating save record in DB");
      const save = await database.save.create({
        data: {
          title,
          url,
          excerpt,
          favicon_url,
          userId: dbUser.id,
          isRead: false,
          isArchived: false,
          featured_image_url: featured_image_url,
          isFetchingAllowed: isFetchingAllowed,
        },
      });
      console.log("~ 🚀: addSave - save created", save.id);
      return {
        success: true,
        data: {
          id: save.id,
          title: save.title,
          url: save.url,
          excerpt: save.excerpt,
          favicon_url: save.favicon_url, // Include new field
          isArchived: save.isArchived,
          createdAt: save.createdAt,
        },
        error: null,
      };
    } catch (error: any) {
      console.log("~ 🚀: addSave - error", error);
      return {
        success: false,
        data: null,
        error: error.message || "Failed to save URL",
      };
    }
  },
  getAllSaves: async (params: GetAllSavesParams): Promise<APIResponse> => {
    try {
      console.log("~ 🚀: getAllSaves - validating params", params);
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
      console.log("~ 🚀: getAllSaves - getting user from token", accessToken);
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        console.log("~ 🚀: getAllSaves - invalid token or user not found", authError);
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      console.log("~ 🚀: getAllSaves - finding user in DB", user.id);
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        console.log("~ 🚀: getAllSaves - user not found in DB");
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
      console.log("~ 🚀: getAllSaves - fetching saves with pagination", { page, limit, where });
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
          favicon_url: true, // Added new field
          featured_image_url: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
          isRead: true,
        },
      });
      // Get total count
      const total = await database.save.count({ where });
      console.log("~ 🚀: getAllSaves - total saves found", total);
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
      console.log("~ 🚀: getAllSaves - error", error);
      return {
        success: false,
        data: null,
        error: error.message || "Failed to get saves",
      };
    }
  },
  getSaveById: async (params: GetSaveByIdParams): Promise<APIResponse> => {
    try {
      console.log("~ 🚀: getSaveById - validating params", params);
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
      console.log("~ 🚀: getSaveById - getting user from token", accessToken);
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        console.log("~ 🚀: getSaveById - invalid token or user not found", authError);
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      console.log("~ 🚀: getSaveById - finding user in DB", user.id);
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        console.log("~ 🚀: getSaveById - user not found in DB");
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }
      // Get save
      console.log("~ 🚀: getSaveById - fetching save by id", id);
      const save = await database.save.findFirst({
        where: {
          id,
          userId: dbUser.id,
        },
        select: { // Explicitly selecting fields to match updated schema and other save functions
          id: true,
          title: true,
          url: true,
          excerpt: true,
          favicon_url: true,
          featured_image_url: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
          isRead: true,
        },
      });
      if (!save) {
        console.log("~ 🚀: getSaveById - save not found");
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
      console.log("~ 🚀: getSaveById - error", error);
      return {
        success: false,
        data: null,
        error: error.message || "Failed to get save",
      };
    }
  },
  deleteSave: async (params: DeleteSaveParams): Promise<APIResponse> => {
    try {
      console.log("~ 🚀: deleteSave - validating params", params);
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
      console.log("~ 🚀: deleteSave - getting user from token", accessToken);
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        console.log("~ 🚀: deleteSave - invalid token or user not found", authError);
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      console.log("~ 🚀: deleteSave - finding user in DB", user.id);
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        console.log("~ 🚀: deleteSave - user not found in DB");
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }
      // Delete save
      console.log("~ 🚀: deleteSave - deleting save", id);
      const save = await database.save.deleteMany({
        where: {
          id,
          userId: dbUser.id,
        },
      });
      if (save.count === 0) {
        console.log("~ 🚀: deleteSave - save not found");
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
      console.log("~ 🚀: deleteSave - error", error);
      return {
        success: false,
        data: null,
        error: error.message || "Failed to delete save",
      };
    }
  },
  toggleArchive: async (params: ToggleArchiveParams): Promise<APIResponse> => {
    try {
      console.log("~ 🚀: toggleArchive - validating params", params);
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
      console.log("~ 🚀: toggleArchive - getting user from token", accessToken);
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        console.log("~ 🚀: toggleArchive - invalid token or user not found", authError);
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }
      // Get user from database
      console.log("~ 🚀: toggleArchive - finding user in DB", user.id);
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        console.log("~ 🚀: toggleArchive - user not found in DB");
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }
      // Get current save
      console.log("~ 🚀: toggleArchive - fetching current save", id);
      const currentSave = await database.save.findFirst({
        where: {
          id,
          userId: dbUser.id,
        },
      });
      if (!currentSave) {
        console.log("~ 🚀: toggleArchive - save not found");
        return {
          success: false,
          data: null,
          error: "Save not found",
        };
      }
      // Toggle archive status
      console.log("~ 🚀: toggleArchive - toggling archive status", { id, isArchived: !currentSave.isArchived });
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
      console.log("~ 🚀: toggleArchive - error", error);
      return {
        success: false,
        data: null,
        error: error.message || "Failed to update archive status",
      };
    }
  },
  updateSave: async (params: UpdateSaveParams): Promise<APIResponse> => {
    try {
      console.log("~ 🚀: updateSave - validating params", params);
      const schema = z.object({
        id: z.string().min(1),
        accessToken: z.string().min(1),
        title: z.string().optional(),
        excerpt: z.string().optional(),
        favicon_url: z.string().optional(),
        featured_image_url: z.string().optional(),
        isRead: z.boolean().optional(),
        isArchived: z.boolean().optional(),
      });
      const validatedParams = schema.safeParse(params);
      if (!validatedParams.success) {
        return {
          success: false,
          data: null,
          error: validatedParams.error.issues[0].message,
        };
      }

      const { id, accessToken, title, excerpt, favicon_url, featured_image_url, isRead, isArchived } = params;

      // Get current user from token
      console.log("~ 🚀: updateSave - getting user from token", accessToken);
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        console.log("~ 🚀: updateSave - invalid token or user not found", authError);
        return {
          success: false,
          data: null,
          error: "Invalid token",
        };
      }

      // Get user from database
      console.log("~ 🚀: updateSave - finding user in DB", user.id);
      const dbUser = await database.user.findUnique({
        where: { supabaseUserId: user.id },
      });
      if (!dbUser) {
        console.log("~ 🚀: updateSave - user not found in DB");
        return {
          success: false,
          data: null,
          error: "User not found",
        };
      }

      // Get current save
      console.log("~ 🚀: updateSave - fetching current save", id);
      const currentSave = await database.save.findFirst({
        where: { id, userId: dbUser.id },
      });
      if (!currentSave) {
        console.log("~ 🚀: updateSave - save not found");
        return {
          success: false,
          data: null,
          error: "Save not found",
        };
      }

      // Build update payload (only update provided fields)
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (excerpt !== undefined) updateData.excerpt = excerpt;
      if (favicon_url !== undefined) updateData.favicon_url = favicon_url;
      if (featured_image_url !== undefined) updateData.featured_image_url = featured_image_url;
      if (isRead !== undefined) updateData.isRead = isRead;
      if (isArchived !== undefined) updateData.isArchived = isArchived;


      console.log("~ 🚀: updateSave - updating save", updateData);

      const updatedSave = await database.save.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          url: true,
          excerpt: true,
          favicon_url: true,
          featured_image_url: true,
          isArchived: true,
          isRead: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        data: updatedSave,
        error: null,
      };
    } catch (error: any) {
      console.log("~ 🚀: updateSave - error", error);
      return {
        success: false,
        data: null,
        error: error.message || "Failed to update save",
      };
    }
  },
};

export default saves;