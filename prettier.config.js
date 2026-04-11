export default {
	plugins: ['prettier-plugin-packagejson'],
	// Only format specific file types (CSS/LESS/package.json)
	// Everything else is handled by Biome
	overrides: [
		{
			files: ['*.css', '*.less'],
			options: {
				printWidth: 130,
				tabWidth: 2,
				useTabs: true,
				singleQuote: true,
			},
		},
		{
			files: 'package.json',
			options: {
				tabWidth: 2,
				useTabs: false,
			},
		},
	],
};
