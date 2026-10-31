export default function middleware(request) {
  const url = new URL(request.url);
  const hostname = request.headers.get('host') || '';

  if (hostname === 'appeal.thehollow.gifts' && url.pathname === '/') {
    return Response.rewrite(new URL('/quests.html', request.url));
  }
}
