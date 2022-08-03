import { defineConfig } from 'vite'
import { resolve, join } from 'path'
import os from 'os'
import FastGlob from 'fast-glob'
import lodash from 'lodash'
import chalk from 'chalk'
import autoprefixer from 'autoprefixer'
import postcssImport from 'postcss-import'
import postcssNesting from 'postcss-nesting'
import postcssCustomMedia from 'postcss-custom-media'
import postcssCustomSelectors from 'postcss-custom-selectors'
import fs from 'fs'
import run from 'vite-plugin-run'
import { tailwindAnimations, tailwindColorsAccent, tailwindColors, tailwindColorsCurrent, tailwindVariables } from './utils/tailwind.js'

const optionalPlugin = {}

async function definePackage(plugin) {
    try {
        optionalPlugin[plugin] = (await import(plugin)).default
    } catch {}
}

await definePackage('tailwindcss')
await definePackage('tailwindcss/nesting/index.js')
await definePackage('vite-plugin-latte')
await definePackage('vite-plugin-twig')

const config = {
    input: ['./src/views/**/*.html', './src/styles/**/*.css', './src/scripts/**/*.js'],
    output: resolve(process.cwd(), 'public'),
    root: resolve(process.cwd(), 'src'),
    plugins: [],
    server: {
        open: '/',
        https: false,
        cert: 'localhost',
        run: []
    },
    autoImport: {
        paths: ['styles/**/*.css', 'scripts/**/*.js'],
        filename: '+'
    },
    templates: {
        format: 'latte',
        latte: {},
        twig: {}
    },
    styles: {
        postcss: {
            plugins: [postcssImport, postcssNesting, postcssCustomMedia, postcssCustomSelectors, autoprefixer]
        },
        tailwindcss: true
    },
    emails: {
        distDir: ''
    },
    vite: {
        server: {
            host: true,
            fsServe: {
                strict: false
            }
        },
        build: {
            manifest: true,
            emptyOutDir: false,
            polyfillModulePreload: false
        }
    }
}

const middleware = {
    name: 'middleware',
    apply: 'serve',
    configureServer(viteDevServer) {
        return () => {
            viteDevServer.middlewares.use(async(req, res, next) => {
                if (!req.originalUrl.startsWith('/views')) {
                    req.originalUrl = '/views' + req.originalUrl
                }

                if (!req.originalUrl.endsWith('.html') &&
                    (req.originalUrl !== '/' && !req.originalUrl.endsWith('/'))) {
                    req.originalUrl = req.originalUrl + '.html'
                } else if (!req.originalUrl.endsWith('.html')) {
                    req.originalUrl = req.originalUrl + 'index.html'
                }

                req.url = req.originalUrl

                next()
            })
        }
    }
}

function userConfig(userConfig) {
    lodash.merge(config, userConfig)

    const plugins = [
        middleware
    ]

    if (config.templates.format.includes('latte')) {
        if (optionalPlugin['vite-plugin-latte']) {
            plugins.push(optionalPlugin['vite-plugin-latte'](lodash.merge({
                globals: {
                    template: resolve(process.cwd(), 'src/templates/latte/Layout/Main.latte'),
                    srcPath: resolve(process.cwd(), 'src')
                },
                data: './src/data/**/*.json'
            }, config.templates.latte)))
        } else {
            console.error(chalk.red('vite-plugin-latte not installed'))
        }
    }

    if (config.templates.format.includes('twig')) {
        if (optionalPlugin['vite-plugin-twig']) {
            plugins.push(optionalPlugin['vite-plugin-twig'](lodash.merge({}, config.templates.twig)))
        } else {
            console.error(chalk.red('vite-plugin-twig not installed'))
        }
    }

    if (config.styles.tailwindcss) {
        if (optionalPlugin.tailwindcss) {
            config.styles.postcss.plugins = [postcssImport, optionalPlugin['tailwindcss/nesting/index.js'](postcssNesting), postcssCustomMedia, postcssCustomSelectors, optionalPlugin.tailwindcss, autoprefixer]
        } else {
            console.error(chalk.red('tailwindcss not installed'))
        }
    }

    plugins.push(run(config.server.run))
    plugins.push(...plugins)

    if (config.server.https && fs.existsSync(join(os.homedir(), `.ssh/${config.server.cert}.pem`)) && fs.existsSync(join(os.homedir(), `.ssh/${config.server.cert}-key.pem`))) {
        config.vite.server = {
            https: {
                key: fs.readFileSync(join(os.homedir(), `.ssh/${config.server.cert}-key.pem`)),
                cert: fs.readFileSync(join(os.homedir(), `.ssh/${config.server.cert}.pem`))
            }
        }
    }

    return defineConfig(lodash.merge({
        vituum: config,
        plugins,
        resolve: {
            alias: {
                '/src': config.root
            }
        },
        root: config.root,
        publicDir: config.output,
        css: {
            postcss: config.styles.postcss
        },
        build: {
            outDir: config.output,
            rollupOptions: {
                input: FastGlob.sync(config.input).map(entry => resolve(process.cwd(), entry))
            }
        }
    }, config.vite))
}

export { userConfig as defineConfig, config, tailwindAnimations, tailwindColorsAccent, tailwindColors, tailwindColorsCurrent, tailwindVariables }
