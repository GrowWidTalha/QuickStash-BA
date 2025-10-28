"use client";

import { useState, useTransition } from "react";
import { registerAction } from "@/lib/actions";

export default function TestEmailPage() {
	const [message, setMessage] = useState<string>("");
	const [isPending, startTransition] = useTransition();

	return (
		<div className="max-w-md mx-auto py-16 px-6">
			<h1 className="text-2xl font-semibold mb-6">Test Welcome Email</h1>
			<p className="text-sm text-gray-600 mb-8">
				Submit the form to create a user via register(). On success, a welcome email will be sent automatically using Resend.
			</p>
			<form
				action={(formData) => {
					setMessage("");
					startTransition(async () => {
						try {
							const res = await registerAction(formData);
							if (res.success) {
								setMessage("Success: user created and welcome email triggered.");
							} else {
								setMessage(`Error: ${res.error || "Unknown error"}`);
							}
						} catch (e: any) {
							setMessage(`Unexpected error: ${e?.message || e}`);
						}
					});
				}}
				className="space-y-4"
			>
				<div className="space-y-2">
					<label htmlFor="email" className="block text-sm font-medium">
						Email
						<span className="text-red-500">*</span>
					</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						placeholder="you@example.com"
						className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div className="space-y-2">
					<label htmlFor="password" className="block text-sm font-medium">
						Password
						<span className="text-red-500">*</span>
					</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						placeholder="••••••••"
						className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<button
					type="submit"
					disabled={isPending}
					className="w-full rounded-md bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700 disabled:opacity-60"
				>
					{isPending ? "Submitting..." : "Create user & send email"}
				</button>
			</form>

			{message && (
				<div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
					{message}
				</div>
			)}
		</div>
	);
}
