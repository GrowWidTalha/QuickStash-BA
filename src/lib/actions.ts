"use server";

export async function registerAction(formData: FormData) {
	const authentication = (await import("@/functions/authentication")).default;
	const email = String(formData.get("email") || "").trim();
	const password = String(formData.get("password") || "").trim();
	return authentication.register({ email, password });
}