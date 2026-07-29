export function getAuthRedirectUrl() {
  const url = new URL(window.location.href)
  let pathname = url.pathname

  if (pathname.endsWith('.html')) {
    pathname = pathname.slice(0, pathname.lastIndexOf('/') + 1)
  }

  if (!pathname.endsWith('/')) {
    pathname = `${pathname}/`
  }

  return `${url.origin}${pathname}`
}
