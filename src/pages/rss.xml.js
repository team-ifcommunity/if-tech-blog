import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';

export async function GET(context) {
	const posts = await getCollection('blog');
	return rss({
		title: SITE.title,
		description: SITE.desc,
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: `/posts/${post.data.slug?.trim() || post.slug}/`,
			updatedDate: post.data.updatedDate,
			pubDate: post.data.pubDate,
			heroImage: post.data.heroImage,
			category: post.data.category
		}))
	});
}
