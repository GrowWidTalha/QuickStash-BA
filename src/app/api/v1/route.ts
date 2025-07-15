import { functions, Ifunctions } from "@/functions";
import { NextRequest } from "next/server";
import { z } from "zod";

// Validate request body schema
const requestSchema = z.object({
  apiKey: z.string(),
  function: z.string(),
  params: z.any(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const result = requestSchema.safeParse(body);
    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request body",
          details: result.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { apiKey, function: functionName, params } = result.data;

    const API_KEY = process.env.API_KEY;

    if (apiKey !== API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid API key",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if function exists and is callable
    const fn = (functions as any)[functionName];
    if (typeof fn !== "function") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Function not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Execute function with type safety
    const apiFunction: any =
      fn as (typeof functions)[keyof Ifunctions];
    const response = await apiFunction(params);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("API Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}