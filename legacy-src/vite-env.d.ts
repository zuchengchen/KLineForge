/// <reference types="vite/client" />

interface KLineForgeDesktopApi {
  readonly appVersion: string;
  readonly platform:
    | 'aix'
    | 'android'
    | 'darwin'
    | 'freebsd'
    | 'haiku'
    | 'linux'
    | 'openbsd'
    | 'sunos'
    | 'win32'
    | 'cygwin'
    | 'netbsd';
}

interface Window {
  readonly klineforgeDesktop?: KLineForgeDesktopApi;
}
