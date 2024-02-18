module.exports = {
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-type-checked',
        'plugin:prettier/recommended',
    ],
    "parserOptions": {
        "project": ["./tsconfig.json"]
    },
};