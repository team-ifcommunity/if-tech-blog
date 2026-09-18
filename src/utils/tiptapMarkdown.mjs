import { MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown';

const markdownSerializer = new MarkdownSerializer(
	{
		blockquote: defaultMarkdownSerializer.nodes.blockquote,
		bulletList: defaultMarkdownSerializer.nodes.bullet_list,
		codeBlock(state, node) {
			const backticks = node.textContent.match(/`{3,}/gm);
			const fence = backticks ? `${backticks.sort().at(-1)}\`` : '```';
			const language = /^[a-z0-9_+-]+$/i.test(node.attrs.language) ? node.attrs.language : '';
			state.write(`${fence}${language}\n`);
			state.text(node.textContent, false);
			state.write(`\n${fence}`);
			state.closeBlock(node);
		},
		hardBreak: defaultMarkdownSerializer.nodes.hard_break,
		heading: defaultMarkdownSerializer.nodes.heading,
		listItem: defaultMarkdownSerializer.nodes.list_item,
		orderedList(state, node) {
			const start = node.attrs.start ?? 1;
			const maxWidth = String(start + node.childCount - 1).length;
			const space = state.repeat(' ', maxWidth + 2);
			state.renderList(node, space, (index) => {
				const number = String(start + index);
				return `${state.repeat(' ', maxWidth - number.length)}${number}. `;
			});
		},
		paragraph: defaultMarkdownSerializer.nodes.paragraph,
		text: defaultMarkdownSerializer.nodes.text
	},
	{
		bold: defaultMarkdownSerializer.marks.strong,
		code: defaultMarkdownSerializer.marks.code,
		italic: defaultMarkdownSerializer.marks.em,
		link: defaultMarkdownSerializer.marks.link
	},
	{
		escapeExtraCharacters: /[{}<>]/g,
		hardBreakNodeName: 'hardBreak'
	}
);

/**
 * 지원하는 Tiptap 문서를 기존 게시 API가 받는 Markdown/MDX 본문으로 변환합니다.
 * @param {import('@tiptap/pm/model').Node} doc
 */
export function serializeTiptapToMarkdown(doc) {
	return markdownSerializer.serialize(doc).trim();
}
