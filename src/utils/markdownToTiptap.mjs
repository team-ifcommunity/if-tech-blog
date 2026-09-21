import { defaultMarkdownParser } from 'prosemirror-markdown';

export function parseMarkdownForTiptap(markdown) {
	const rawBlocks = [];
	let prepared = markdown.replace(/^[ \t]*(<[A-Z][\s\S]*?\/>)[ \t]*$/gm, (raw) => {
		if (/^\s*<AssetImage\b/.test(raw)) return raw;
		const index = rawBlocks.push(raw.trim()) - 1;
		return `MDXRAWBLOCK${index}TOKEN`;
	});

	prepared = prepared.replace(
		/<AssetImage\s+src=(?:\{)?["']([^"']+)["'](?:\})?(?:\s+alt=(?:\{)?["']([^"']*)["'](?:\})?)?\s*\/>/g,
		(_, src, alt = '') => `![${alt.replace(/\]/g, '\\]')}](${src})`
	);
	prepared = prepared.replace(/<br\s*\/>/gi, '  \n');

	const source = defaultMarkdownParser.parse(prepared).toJSON();
	return transformNode(source, rawBlocks);
}

function transformNode(node, rawBlocks) {
	if (node.type === 'paragraph' && node.content?.length === 1 && node.content[0].type === 'image') {
		return transformNode(node.content[0], rawBlocks);
	}
	if (node.type === 'paragraph' && node.content?.length === 1 && node.content[0].type === 'text') {
		const match = node.content[0].text?.match(/^MDXRAWBLOCK(\d+)TOKEN$/);
		if (match) return { type: 'rawMdx', attrs: { value: rawBlocks[Number(match[1])] } };
	}

	const typeMap = {
		blockquote: 'blockquote',
		bullet_list: 'bulletList',
		code_block: 'codeBlock',
		hard_break: 'hardBreak',
		horizontal_rule: 'horizontalRule',
		list_item: 'listItem',
		ordered_list: 'orderedList',
		strong: 'bold',
		em: 'italic'
	};
	const result = { ...node, type: typeMap[node.type] ?? node.type };
	if (node.type === 'code_block') result.attrs = { language: node.attrs?.params || null };
	if (node.type === 'image') result.attrs = { ...node.attrs, assetSrc: node.attrs?.src };
	if (node.marks) result.marks = node.marks.map((mark) => transformNode(mark, rawBlocks));
	if (node.content) result.content = node.content.map((child) => transformNode(child, rawBlocks));
	return result;
}
