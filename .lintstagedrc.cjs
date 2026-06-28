module.exports = {
  '**/*.{js,jsx,ts,tsx,d.tsx,md,yml,yaml,json,css,less,scss,sass,html,mjs}': 'prettier --config .prettierrc.cjs --write',
  '**/*.{ts,tsx,d.ts,mjs}': (files) => {
    const filteredFiles = files.filter(
      (file) =>
        !file.includes('node_modules') &&
        !file.includes('game/public') &&
        !file.includes('game/dist') &&
        !file.includes('.next') &&
        !file.includes('typings.d/') &&
        !file.endsWith('next-env.d.ts')
    )
    if (filteredFiles.length === 0) return []
    return `eslint --config eslint.config.mjs --fix --max-warnings 0 ${filteredFiles.join(' ')}`
  },
}
