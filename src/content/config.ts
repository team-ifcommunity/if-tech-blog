import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string(),
		author: z.string().optional(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.string().optional(),
		category: z.string().optional(),
		ref: z.array(z.string()).optional(),
		isWarning: z.boolean().optional(),
		slug: z.string().optional()
	})
});

export const collections = {
	blog
};
