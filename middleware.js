import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
    if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname === '/login') {
        return NextResponse.next();
          }
            const cookie = request.cookies.get('apex_auth');
              if (cookie && cookie.value === 'wonka') {
                  return NextResponse.next();
                    }
                      const url = request.nextUrl.clone();
                        url.pathname = '/login';
                          return NextResponse.redirect(url);
                          }

                          export const config = {
                            matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
                            };
