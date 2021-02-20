const {
  getResourceURLsForPathname,
  loadPage,
  loadPageSync,
} = require(`./loader`).publicLoader
const { nextTick } = require(`./next-tick`)

let plugins = null

exports.startPluginsAsync = async () => {
  const buffer = []

  await Promise.all(
    require(`./api-runner-browser-plugins`).map(plugin =>
      nextTick(() => {
        plugin.plugin = plugin.pluginFn()

        buffer.push(plugin)
      })
    )
  )

  plugins = buffer
}

exports.apiRunner = (api, args = {}, defaultReturn, argTransform) => {
  if (plugins === null) {
    console.error(`plugins not started`)
    throw new Error(`plugins not started`)
  }

  // Hooks for gatsby-cypress's API handler
  if (process.env.CYPRESS_SUPPORT) {
    if (window.___apiHandler) {
      window.___apiHandler(api)
    } else if (window.___resolvedAPIs) {
      window.___resolvedAPIs.push(api)
    } else {
      window.___resolvedAPIs = [api]
    }
  }

  let results = plugins.map(plugin => {
    if (!plugin.plugin[api]) {
      return undefined
    }

    args.getResourceURLsForPathname = getResourceURLsForPathname
    args.loadPage = loadPage
    args.loadPageSync = loadPageSync

    const result = plugin.plugin[api](args, plugin.options)
    if (result && argTransform) {
      args = argTransform({ args, result, plugin })
    }
    return result
  })

  // Filter out undefined results.
  results = results.filter(result => typeof result !== `undefined`)

  if (results.length > 0) {
    return results
  } else if (defaultReturn) {
    return [defaultReturn]
  } else {
    return []
  }
}

exports.apiRunnerAsync = (api, args, defaultReturn) => {
  if (plugins === null) {
    console.error(`plugins not started`)
    throw new Error(`plugins not started`)
  }

  return plugins.reduce(
    (previous, next) =>
      next.plugin[api]
        ? previous.then(() => next.plugin[api](args, next.options))
        : previous,
    Promise.resolve()
  )
}
