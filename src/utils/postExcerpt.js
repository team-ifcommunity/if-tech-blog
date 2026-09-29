/** Extract a plain-text preview without MDX imports, image markup or formatting. */
export function postExcerpt(source = '', limit = 180) {
	const text = source
		.replace(/^\s*(?:import|export)\s+[^\n]+$/gm, '')
		.replace(/<!--[^]*?-->/g, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/!\[[^\]]*\]\[[^\]]*\]/g, ' ')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
		.replace(/^\s*\[[^\]]+\]:[^\n]*$/gm, '')
		.replace(/^\s*(?:```|~~~)[^\n]*$/gm, '')
		.replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/gm, '')
		.replace(/[*_`~|]/g, '')
		.replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) =>
			({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity] || entity)
		.replace(/\s+/g, ' ')
		.trim();
	const characters = Array.from(text);
	return characters.length > limit ? characters.slice(0, limit).join('') + '…' : text;
}
