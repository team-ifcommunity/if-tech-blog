const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

export function validateImageFile(file: File, label = '이미지') {
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

	if (!ALLOWED_IMAGE_TYPES.has(file.type) || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
		return 'PNG, JPG, JPEG, WEBP 형식의 이미지만 업로드할 수 있습니다.';
	}

	if (file.size === 0) return '비어 있는 파일은 업로드할 수 없습니다.';
	if (file.size > MAX_FILE_SIZE) return `${label} 크기는 3MB 이하여야 합니다.`;

	return '';
}

export function fileToBase64(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = typeof reader.result === 'string' ? reader.result : '';
			const contentBase64 = result.split(',')[1];
			if (contentBase64) resolve(contentBase64);
			else reject(new Error('이미지 파일을 읽지 못했습니다.'));
		};
		reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
		reader.readAsDataURL(file);
	});
}
