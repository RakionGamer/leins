// agrega ?entityId=<id> al path dado (mantiene otros query params si los hubiera)
export function withEntityId(path, entityId) {
   if (!entityId) return path;
   const url = new URL(path, window.location.origin);
   url.searchParams.set('entityId', entityId);
   return url.pathname + url.search;
}