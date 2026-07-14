import { createPostcssConfig } from 'ave-css/postcss';

export default createPostcssConfig({
	additionalFunctions: {
		// Usage: width: px(24); -> width: 24px;
		px: (value) => `${value}px`,
	},
	additionalMixins: {
		// Usage: @mixin focus-ring #0ea5e9;
		"focus-ring": (_mixin, color = "#0ea5e9") => ({
			"&:focus-visible": {
				outline: `2px solid ${color}`,
				"outline-offset": "2px",
			},
		}),
	},
});
